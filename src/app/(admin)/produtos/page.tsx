"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Search, Image as ImageIcon, X, Trash2, Loader2 } from "lucide-react";
import { addDoc, collection, deleteDoc, deleteField, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input } from "@/components/ui/Input";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Modal, ModalTitle, ModalBody } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { fadeIn } from "@/lib/animations";
import { formatBRL, cn } from "@/lib/utils";
import { useCloudinaryUpload } from "@/lib/hooks/useCloudinaryUpload";
import { useProdutos } from "@/lib/hooks/useProdutos";
import { useCategorias } from "@/lib/hooks/useCategorias";
import { useCores, useCoresCoral } from "@/lib/hooks/useCores";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/cloudinary";
import type { CorTinta, Produto, ProdutoCor, ProdutoVariacao } from "@/lib/types";

interface Foto {
  id: string;
  url: string;
}

type ExclusaoAlvo =
  | { tipo: "produto" }
  | { tipo: "cor"; nome: string }
  | { tipo: "volume"; nome: string }
  | { tipo: "paleta"; paleta: "suvinil" | "coral" };

const TODAS_CORES_KEY = "__todas__";

function chave(cor: string, volume: string) {
  return `${cor}|${volume}`;
}

export default function ProdutosPage() {
  const { showToast } = useToast();
  const { produtos: lista, loading: carregandoLista } = useProdutos();
  const { categorias } = useCategorias();
  const { cores: paletaCores } = useCores();
  const { cores: paletaCoresCoral } = useCoresCoral();
  const [view, setView] = useState<"lista" | "editor">("lista");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [soBaixo, setSoBaixo] = useState(false);
  const [criandoProduto, setCriandoProduto] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState<{ titulo: string; corpo: string; alvo: ExclusaoAlvo } | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // editor state
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [produtoNome, setProdutoNome] = useState("");
  const [produtoCategoriaId, setProdutoCategoriaId] = useState("");
  const [produtoDescricao, setProdutoDescricao] = useState("");
  const [produtoAtivo, setProdutoAtivo] = useState(true);
  const [limite, setLimite] = useState(15);
  const [desconto, setDesconto] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [cores, setCores] = useState<ProdutoCor[]>([]);
  const [todasCores, setTodasCores] = useState(false);
  const [paletaTodasCores, setPaletaTodasCores] = useState<"suvinil" | "coral">("suvinil");
  const [ambientes, setAmbientes] = useState<("interior" | "exterior")[]>([]);
  const [seletorCorAberto, setSeletorCorAberto] = useState(false);
  const [seletorVolumeAberto, setSeletorVolumeAberto] = useState(false);
  const [volumes, setVolumes] = useState<string[]>([]);
  const [vars, setVars] = useState<Record<string, ProdutoVariacao>>({});
  const varsOriginaisRef = useRef<Record<string, ProdutoVariacao>>({});
  const [editando, setEditando] = useState<string | null>(null);
  const [precoDraft, setPrecoDraft] = useState("");
  const [estoqueDraft, setEstoqueDraft] = useState("");
  const [specs, setSpecs] = useState<{ nome: string; valor: string }[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [dragFoto, setDragFoto] = useState<string | null>(null);
  const [dragOverZona, setDragOverZona] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadMany, uploading } = useCloudinaryUpload({
    folder: "nova-era-tintas/produtos",
    onError: (message) => showToast(message),
  });

  const vagasFoto = 8 - fotos.length;

  async function adicionarFotos(files: FileList | File[]) {
    const lista = Array.from(files).slice(0, Math.max(vagasFoto, 0));
    if (lista.length === 0) return;
    const results = await uploadMany(lista);
    if (results.length === 0) return;
    setFotos((list) => [...list, ...results.map((r) => ({ id: r.publicId, url: r.url }))]);
    showToast(results.length === 1 ? "Foto adicionada" : `${results.length} fotos adicionadas`);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setConfirmarExcluir(null);
        setEditando(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function categoriaNome(categoriaId: string) {
    return categorias.find((c) => c.id === categoriaId)?.nome ?? categoriaId;
  }

  function faixaPreco(p: Produto) {
    const precos = Object.values(p.variacoes).map((v) => v.preco);
    if (precos.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...precos), max: Math.max(...precos) };
  }

  function estoqueTotal(p: Produto) {
    if (p.todasCores) return Infinity;
    return Object.values(p.variacoes).reduce((a, v) => a + v.estoque, 0);
  }

  const q = busca.trim().toLowerCase();
  const produtos = lista.filter(
    (p) =>
      (!q || p.nome.toLowerCase().includes(q)) &&
      (!categoria || p.categoriaId === categoria) &&
      (!soBaixo || estoqueTotal(p) < p.limiteEstoqueBaixo)
  );

  function cellColor(estoque: number) {
    if (estoque === 0) return "#D92D20";
    if (estoque < limite) return "#B54708";
    return "#667085";
  }

  function salvarCelula(key: string) {
    const preco = parseFloat(precoDraft.replace(",", ".")) || 0;
    const estoque = parseInt(estoqueDraft, 10) || 0;
    const [cor, volume] = key.split("|");
    setVars((v) => ({ ...v, [key]: { ...v[key], cor, volume, preco, estoque, ativo: v[key]?.ativo ?? true } }));
    setEditando(null);
  }

  function toggleVarAtiva(key: string) {
    setVars((v) => {
      const cur = v[key];
      if (!cur) return v;
      return { ...v, [key]: { ...cur, ativo: !cur.ativo } };
    });
    showToast("Variação atualizada");
  }

  const varValues = Object.values(vars);
  const totalEstoque = varValues.reduce((a, v) => a + v.estoque, 0);
  const precos = varValues.map((v) => v.preco);
  const precoMin = precos.length > 0 ? Math.min(...precos) : 0;
  const precoMax = precos.length > 0 ? Math.max(...precos) : 0;

  function abrirEditor(p: Produto) {
    setProdutoId(p.id);
    setProdutoNome(p.nome);
    setProdutoCategoriaId(p.categoriaId);
    setProdutoDescricao(p.descricao);
    setProdutoAtivo(p.ativo);
    setLimite(p.limiteEstoqueBaixo);
    setDesconto(p.descontoPct);
    setCores(p.cores);
    setTodasCores(p.todasCores ?? false);
    setPaletaTodasCores(p.paletaTodasCores ?? "suvinil");
    setAmbientes(p.ambientes ?? []);
    setVolumes(p.volumes);
    setVars(p.variacoes);
    varsOriginaisRef.current = p.variacoes;
    setSpecs(p.specs);
    setFotos(p.fotos);
    setView("editor");
  }

  async function novoProduto() {
    setCriandoProduto(true);
    try {
      const primeiraCategoria = categorias[0];
      const ref = await addDoc(collection(db, "produtos"), {
        nome: "Novo produto",
        categoriaId: primeiraCategoria?.id ?? "",
        categoria: primeiraCategoria?.nome ?? "",
        descricao: "",
        limiteEstoqueBaixo: 10,
        descontoPct: 0,
        ativo: false,
        cores: [],
        volumes: [],
        variacoes: {},
        specs: [],
        fotos: [],
        criado_em: serverTimestamp(),
      });
      abrirEditor({
        id: ref.id,
        nome: "Novo produto",
        categoriaId: primeiraCategoria?.id ?? "",
        categoria: primeiraCategoria?.nome ?? "",
        descricao: "",
        limiteEstoqueBaixo: 10,
        descontoPct: 0,
        ativo: false,
        cores: [],
        volumes: [],
        variacoes: {},
        specs: [],
        fotos: [],
      });
      showToast("Produto criado — preencha e salve");
    } catch (err) {
      console.error("Erro ao criar produto", err);
      showToast("Não deu para criar o produto. Tente de novo.");
    } finally {
      setCriandoProduto(false);
    }
  }

  async function salvarProduto() {
    if (!produtoId) return;
    setSalvando(true);
    try {
      const variacoesRemovidas: Record<string, ReturnType<typeof deleteField>> = {};
      for (const key of Object.keys(varsOriginaisRef.current)) {
        if (!(key in vars)) variacoesRemovidas[key] = deleteField();
      }
      await setDoc(
        doc(db, "produtos", produtoId),
        {
          nome: produtoNome,
          descricao: produtoDescricao,
          categoriaId: produtoCategoriaId,
          categoria: categoriaNome(produtoCategoriaId),
          limiteEstoqueBaixo: limite,
          descontoPct: desconto,
          cores: todasCores ? [] : cores,
          todasCores,
          paletaTodasCores: todasCores ? paletaTodasCores : deleteField(),
          ambientes,
          volumes,
          variacoes: { ...variacoesRemovidas, ...vars },
          specs,
          fotos,
          ativo: produtoAtivo,
          atualizado_em: serverTimestamp(),
        },
        { merge: true }
      );
      varsOriginaisRef.current = vars;
      showToast("Produto salvo");
      setView("lista");
    } catch (err) {
      console.error("Erro ao salvar produto", err);
      showToast("Não deu para salvar o produto. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  function removerCor(nome: string) {
    setCores((c) => c.filter((x) => x.nome !== nome));
    setVars((v) => {
      const next = { ...v };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${nome}|`)) delete next[key];
      }
      return next;
    });
  }

  function alternarAmbiente(ambiente: "interior" | "exterior", ativo: boolean) {
    setAmbientes((atuais) =>
      ativo ? (atuais.includes(ambiente) ? atuais : [...atuais, ambiente]) : atuais.filter((a) => a !== ambiente)
    );
  }

  function selecionarModoCores(modo: "especificas" | "suvinil" | "coral") {
    if (modo === "especificas") {
      setTodasCores(false);
      setVars({});
      return;
    }
    setTodasCores(true);
    setPaletaTodasCores(modo);
    setCores([]);
    setVars((v) => {
      const next: Record<string, ProdutoVariacao> = {};
      for (const vol of volumes) {
        const key = chave(TODAS_CORES_KEY, vol);
        next[key] = v[key] ?? { cor: TODAS_CORES_KEY, volume: vol, preco: 0, estoque: 0, ativo: true };
      }
      return next;
    });
  }

  function trocarPaletaEspecifica(paleta: "suvinil" | "coral") {
    if (paleta === paletaTodasCores) return;
    if (cores.length === 0) {
      setPaletaTodasCores(paleta);
      return;
    }
    setConfirmarExcluir({
      titulo: `Trocar para paleta ${paleta === "coral" ? "Coral" : "Suvinil"}?`,
      corpo: `${cores.length} cor(es) escolhida(s) da paleta atual somem junto com as variações. Isso não volta atrás.`,
      alvo: { tipo: "paleta", paleta },
    });
  }

  function removerVolume(nome: string) {
    setVolumes((v) => v.filter((x) => x !== nome));
    setVars((v) => {
      const next = { ...v };
      for (const key of Object.keys(next)) {
        if (key.endsWith(`|${nome}`)) delete next[key];
      }
      return next;
    });
  }

  return (
    <main className="min-w-0 flex-1 bg-paper p-10">
      <AnimatePresence mode="wait">
        {view === "lista" ? (
          <motion.div key="lista" variants={fadeIn} initial="hidden" animate="visible" exit="exit">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="m-0 text-[30px] font-semibold tracking-tight">Produtos</h1>
                <p className="mt-1.5 text-[15px] text-ink-soft">
                  <span className="font-mono">{lista.length}</span> produtos ·{" "}
                  <button
                    type="button"
                    onClick={() => setSoBaixo(true)}
                    className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[15px] font-medium text-status-amber underline decoration-1 underline-offset-3"
                  >
                    <span className="font-mono">{lista.filter((p) => estoqueTotal(p) < p.limiteEstoqueBaixo).length}</span> com estoque baixo
                  </button>
                </p>
              </div>
              <Button className="shrink-0" loading={criandoProduto} onClick={novoProduto}>
                + Novo produto
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="relative flex w-80 max-w-full">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-3 text-ink-soft" strokeWidth={2} />
                <Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto" className="pl-9" />
              </div>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="h-10 w-50 rounded-lg border border-border bg-white px-3 text-sm"
              >
                <option value="">Todas as categorias</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                <motion.input
                  type="checkbox"
                  checked={soBaixo}
                  onChange={(e) => setSoBaixo(e.target.checked)}
                  whileTap={{ scale: 0.85 }}
                  className="h-4 w-4 accent-primary"
                />
                Só estoque baixo
              </label>
              <Link href="/produtos/cores" className="ml-auto text-sm font-medium no-underline">
                Gerenciar cores
              </Link>
              <Link href="/produtos/cores-coral" className="text-sm font-medium no-underline">
                Gerenciar cores Coral
              </Link>
              <Link href="/produtos/categorias" className="text-sm font-medium no-underline">
                Gerenciar categorias
              </Link>
            </div>

            {carregandoLista ? (
              <div className="mt-14 flex justify-center">
                <Loader2 size={22} className="animate-spin text-primary" />
              </div>
            ) : produtos.length > 0 ? (
              <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-white">
                <div className="grid grid-cols-[64px_minmax(220px,2.4fr)_minmax(110px,1fr)_80px_minmax(160px,1.4fr)_100px_64px] items-center gap-3 border-b border-border bg-paper px-5 text-xs font-medium uppercase tracking-wider text-ink-soft" style={{ height: 44 }}>
                  <div />
                  <div>Produto</div>
                  <div>Categoria</div>
                  <div>Variações</div>
                  <div>Preço</div>
                  <div className="text-right">Estoque</div>
                  <div className="text-right">Ativo</div>
                </div>
                {produtos.map((p) => {
                  const { min, max } = faixaPreco(p);
                  const estoque = estoqueTotal(p);
                  const swatch = p.todasCores
                    ? "linear-gradient(135deg, #F04438, #F79009, #12B76A, #2E90FA, #7A5AF8)"
                    : (p.cores[0]?.hex ?? "#E4E7EC");
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => abrirEditor(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          abrirEditor(p);
                        }
                      }}
                      className="grid min-h-15 cursor-pointer grid-cols-[64px_minmax(220px,2.4fr)_minmax(110px,1fr)_80px_minmax(160px,1.4fr)_100px_64px] items-center gap-3 border-b border-border px-5 transition-colors hover:bg-black/[0.02]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-border bg-paper">
                        {p.fotos[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.fotos[0].url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-[3px]" style={{ background: swatch }} />
                        )}
                      </div>
                      <div className="text-sm font-medium">{p.nome}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
                        {p.categoria}
                        {p.ambientes?.map((a) => (
                          <span key={a} className="rounded-full border border-border bg-paper px-2 py-0.5 text-[11px] font-medium capitalize text-ink-soft">
                            {a}
                          </span>
                        ))}
                      </div>
                      <div className="font-mono text-sm text-ink-soft">{Object.keys(p.variacoes).length}</div>
                      <div className="whitespace-nowrap font-mono text-sm">
                        {min === max ? formatBRL(min) : `${formatBRL(min)} – ${formatBRL(max)}`}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 font-mono text-sm" style={{ color: p.todasCores ? "#667085" : estoque === 0 ? "#D92D20" : estoque < p.limiteEstoqueBaixo ? "#B54708" : "#101828" }}>
                        {p.todasCores ? "—" : estoque}
                        {!p.todasCores && estoque < p.limiteEstoqueBaixo && <span className="h-2 w-2 rounded-full" style={{ background: estoque === 0 ? "#D92D20" : "#B54708" }} />}
                      </div>
                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <Switch checked={p.ativo} onChange={() => updateDoc(doc(db, "produtos", p.id), { ativo: !p.ativo })} aria-label={`Ativar/desativar ${p.nome}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-border bg-white px-6 py-14 text-center">
                <div className="text-base font-semibold">Nenhum produto com esse nome.</div>
                <div className="mt-1.5 text-sm text-ink-soft">Tente outro termo ou limpe os filtros.</div>
                <button
                  type="button"
                  onClick={() => {
                    setBusca("");
                    setCategoria("");
                    setSoBaixo(false);
                  }}
                  className="mt-4 cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-medium text-primary"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="editor" variants={fadeIn} initial="hidden" animate="visible" exit="exit">
            <div className="sticky top-0 z-5 -mx-10 -mt-10 bg-paper/90 px-10 pb-5 pt-6 backdrop-blur-sm">
              <div className="text-[13px] text-ink-soft">
                <button type="button" onClick={() => setView("lista")} className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] text-primary">
                  Produtos
                </button>
                <span className="mx-1.5">/</span>
                {produtoNome}
              </div>
              <div className="mt-2 flex items-center justify-between gap-6">
                <h1 className="m-0 text-[26px] font-semibold tracking-tight">{produtoNome}</h1>
                <div className="flex items-center gap-3.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                    <motion.input
                      type="checkbox"
                      checked={produtoAtivo}
                      onChange={(e) => setProdutoAtivo(e.target.checked)}
                      whileTap={{ scale: 0.85 }}
                      className="h-4 w-4 accent-primary"
                    />
                    Ativo
                  </label>
                  <Button onClick={salvarProduto} loading={salvando}>Salvar</Button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmarExcluir({
                        titulo: `Excluir ${produtoNome}?`,
                        corpo: `As ${varValues.length} variações e o histórico de estoque somem junto. Isso não volta atrás.`,
                        alvo: { tipo: "produto" },
                      })
                    }
                    aria-label="Mais ações"
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-lg leading-none text-ink-soft"
                  >
                    …
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[62fr_38fr]">
              <div className="flex min-w-0 flex-col gap-6">
                <section className="rounded-xl border border-border bg-white p-6">
                  <h2 className="m-0 mb-4.5 text-[17px] font-semibold">Informações</h2>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="np-nome" className="text-[13px] font-medium">Nome do produto</label>
                      <Input id="np-nome" value={produtoNome} onChange={(e) => setProdutoNome(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="np-cat" className="text-[13px] font-medium">Categoria</label>
                      <select
                        id="np-cat"
                        value={produtoCategoriaId}
                        onChange={(e) => setProdutoCategoriaId(e.target.value)}
                        className="h-10 rounded-lg border border-border bg-white px-2.5 text-sm"
                      >
                        {categorias.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="np-desc" className="text-[13px] font-medium">Descrição</label>
                      <RichTextEditor id="np-desc" value={produtoDescricao} onChange={setProdutoDescricao} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="np-lim" className="text-[13px] font-medium">Limite de estoque baixo</label>
                      <div className="flex items-center gap-2">
                        <Input id="np-lim" type="number" value={limite} onChange={(e) => setLimite(Number(e.target.value))} className="w-22.5 font-mono" />
                        <span className="text-sm text-ink-soft">unidades</span>
                      </div>
                      <span className="text-xs text-ink-soft">Abaixo disso, o produto aparece marcado na lista.</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-medium">Ambiente</span>
                      <div className="flex gap-4">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <motion.input
                            type="checkbox"
                            checked={ambientes.includes("interior")}
                            onChange={(e) => alternarAmbiente("interior", e.target.checked)}
                            whileTap={{ scale: 0.85 }}
                            className="h-4 w-4 accent-primary"
                          />
                          Interior
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <motion.input
                            type="checkbox"
                            checked={ambientes.includes("exterior")}
                            onChange={(e) => alternarAmbiente("exterior", e.target.checked)}
                            whileTap={{ scale: 0.85 }}
                            className="h-4 w-4 accent-primary"
                          />
                          Exterior
                        </label>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="min-w-0 rounded-xl border border-border bg-white p-6">
                  <h2 className="m-0 text-[17px] font-semibold">Variações</h2>
                  <p className="mb-4 mt-1 text-[13px] text-ink-soft">
                    {todasCores
                      ? "Preço único por volume — não controla estoque por cor."
                      : "Cada combinação de cor e volume tem preço e estoque próprios."}
                  </p>

                  <div className="mb-5 flex flex-wrap gap-4">
                    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                      <motion.input
                        type="radio"
                        name="modoCores"
                        checked={!todasCores}
                        onChange={() => selecionarModoCores("especificas")}
                        whileTap={{ scale: 0.85 }}
                        className="h-4 w-4 accent-primary"
                      />
                      Cores específicas
                    </label>
                    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                      <motion.input
                        type="radio"
                        name="modoCores"
                        checked={todasCores && paletaTodasCores === "suvinil"}
                        onChange={() => selecionarModoCores("suvinil")}
                        whileTap={{ scale: 0.85 }}
                        className="h-4 w-4 accent-primary"
                      />
                      Cores Suvinil
                    </label>
                    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                      <motion.input
                        type="radio"
                        name="modoCores"
                        checked={todasCores && paletaTodasCores === "coral"}
                        onChange={() => selecionarModoCores("coral")}
                        whileTap={{ scale: 0.85 }}
                        className="h-4 w-4 accent-primary"
                      />
                      Cores Coral
                    </label>
                  </div>

                  <div className="mb-5 flex flex-wrap gap-7">
                    {!todasCores && (
                    <div>
                      <div className="mb-2 flex items-center gap-3">
                        <span className="text-xs font-medium uppercase tracking-wider text-ink-soft">Cores</span>
                        <div className="flex overflow-hidden rounded-full border border-border text-[12px]">
                          <button
                            type="button"
                            onClick={() => trocarPaletaEspecifica("suvinil")}
                            className={cn(
                              "cursor-pointer border-0 px-2.5 py-1 font-medium transition-colors",
                              paletaTodasCores === "suvinil" ? "bg-primary text-white" : "bg-transparent text-ink-soft"
                            )}
                          >
                            Suvinil
                          </button>
                          <button
                            type="button"
                            onClick={() => trocarPaletaEspecifica("coral")}
                            className={cn(
                              "cursor-pointer border-0 px-2.5 py-1 font-medium transition-colors",
                              paletaTodasCores === "coral" ? "bg-primary text-white" : "bg-transparent text-ink-soft"
                            )}
                          >
                            Coral
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cores.map((c) => (
                          <span key={c.nome} className="inline-flex items-center gap-2 rounded-full border border-border bg-paper px-3 py-1.5 text-[13px]">
                            <span className="h-3 w-3 rounded-[3px] border border-black/10" style={{ background: c.hex }} />
                            {c.nome}
                            <button
                              type="button"
                              onClick={() => {
                                const afetadas = volumes.filter((v) => vars[chave(c.nome, v)]);
                                const un = afetadas.reduce((a, v) => a + (vars[chave(c.nome, v)]?.estoque ?? 0), 0);
                                setConfirmarExcluir({
                                  titulo: `Remover ${c.nome}?`,
                                  corpo: `${afetadas.length} variações com ${un} unidades no total somem junto. Isso não volta atrás.`,
                                  alvo: { tipo: "cor", nome: c.nome },
                                });
                              }}
                              aria-label={`Remover ${c.nome}`}
                              className="cursor-pointer border-0 bg-transparent p-0 text-sm leading-none text-ink-soft"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <SeletorCorPaleta
                          paleta={paletaTodasCores === "coral" ? paletaCoresCoral : paletaCores}
                          linkCadastro={paletaTodasCores === "coral" ? "/produtos/cores-coral" : "/produtos/cores"}
                          jaEscolhidas={cores}
                          open={seletorCorAberto}
                          onOpenChange={setSeletorCorAberto}
                          onEscolher={(cor) => {
                            setCores((c) =>
                              c.some((x) => x.nome === cor.nome)
                                ? c
                                : [...c, { corId: cor.id, codigo: cor.codigo, nome: cor.nome, hex: cor.hex }]
                            );
                          }}
                        />
                      </div>
                    </div>
                    )}
                    <div>
                      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-soft">Volumes</div>
                      <div className="flex flex-wrap gap-2">
                        {volumes.map((v) => (
                          <span key={v} className="inline-flex items-center gap-2 rounded-full border border-border bg-paper px-3 py-1.5 text-[13px]">
                            {v}
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmarExcluir({
                                  titulo: `Remover ${v}?`,
                                  corpo: "As variações desse volume somem junto. Isso não volta atrás.",
                                  alvo: { tipo: "volume", nome: v },
                                })
                              }
                              aria-label={`Remover ${v}`}
                              className="cursor-pointer border-0 bg-transparent p-0 text-sm leading-none text-ink-soft"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <SeletorVolume
                          jaExistentes={volumes}
                          open={seletorVolumeAberto}
                          onOpenChange={setSeletorVolumeAberto}
                          onAdicionar={(v) =>
                            setVolumes((atuais) => {
                              if (atuais.includes(v)) return atuais;
                              if (todasCores) {
                                const key = chave(TODAS_CORES_KEY, v);
                                setVars((vs) => ({ ...vs, [key]: vs[key] ?? { cor: TODAS_CORES_KEY, volume: v, preco: 0, estoque: 0, ativo: true } }));
                              }
                              return [...atuais, v];
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {todasCores ? (
                    <div className="overflow-x-auto rounded-[10px] border border-border">
                      <div className="grid min-w-full" style={{ gridTemplateColumns: `repeat(${volumes.length}, minmax(130px, 1fr))` }}>
                        {volumes.map((vol) => {
                          const key = chave(TODAS_CORES_KEY, vol);
                          const v = vars[key];
                          const isEditing = editando === key;
                          return (
                            <div key={vol} className="flex min-h-17 flex-col border-t border-border first:border-l-0">
                              <div className="border-b border-border bg-paper px-3 py-3 text-center text-sm font-medium">{vol}</div>
                              <div
                                role="gridcell"
                                tabIndex={0}
                                onClick={() => {
                                  setPrecoDraft(v ? v.preco.toFixed(2).replace(".", ",") : "");
                                  setEditando(key);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    setPrecoDraft(v ? v.preco.toFixed(2).replace(".", ",") : "");
                                    setEditando(key);
                                  }
                                }}
                                className="flex flex-1 cursor-pointer items-center justify-center px-3 py-2.5"
                              >
                                {isEditing ? (
                                  <input
                                    autoFocus
                                    defaultValue={precoDraft}
                                    onChange={(e) => setPrecoDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        const preco = parseFloat(precoDraft.replace(",", ".")) || 0;
                                        setVars((vs) => ({ ...vs, [key]: { cor: TODAS_CORES_KEY, volume: vol, preco, estoque: 0, ativo: true } }));
                                        setEditando(null);
                                      }
                                    }}
                                    onBlur={() => {
                                      const preco = parseFloat(precoDraft.replace(",", ".")) || 0;
                                      setVars((vs) => ({ ...vs, [key]: { cor: TODAS_CORES_KEY, volume: vol, preco, estoque: 0, ativo: true } }));
                                      setEditando(null);
                                    }}
                                    placeholder="0,00"
                                    className="h-7.5 w-20 rounded-md border border-border px-2 text-center font-mono text-[13px]"
                                  />
                                ) : (
                                  <span className="font-mono text-[15px]">{formatBRL(v?.preco ?? 0)}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-[10px] border border-border">
                      <div className="grid min-w-full" style={{ gridTemplateColumns: `180px repeat(${volumes.length}, minmax(130px, 1fr))` }}>
                        <div className="sticky left-0 z-2 border-b border-r border-border bg-paper" />
                        {volumes.map((v) => (
                          <div key={v} className="border-b border-border bg-paper px-3 py-3 text-center text-sm font-medium">
                            {v}
                          </div>
                        ))}
                        {cores.map((c) => (
                          <ProdutoVariacaoRow
                            key={c.nome}
                            cor={c}
                            volumes={volumes}
                            vars={vars}
                            editando={editando}
                            precoDraft={precoDraft}
                            estoqueDraft={estoqueDraft}
                            limite={limite}
                            onCellClick={(key) => {
                              const v = vars[key];
                              setPrecoDraft(v ? v.preco.toFixed(2).replace(".", ",") : "");
                              setEstoqueDraft(v ? String(v.estoque) : "");
                              setEditando(key);
                            }}
                            onSalvarCelula={salvarCelula}
                            onSetPreco={setPrecoDraft}
                            onSetEstoque={setEstoqueDraft}
                            onTogglePausa={toggleVarAtiva}
                            cellColor={cellColor}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 text-[13px] text-ink-soft">
                    {todasCores
                      ? `${volumes.length} volumes · todas as cores ${paletaTodasCores === "coral" ? "Coral" : "Suvinil"}`
                      : `${varValues.length} variações · ${totalEstoque} unidades no total`}
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-white p-6">
                  <h2 className="m-0 mb-4 text-[17px] font-semibold">Especificações</h2>
                  <div className="flex flex-col gap-2.5">
                    {specs.map((s, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <Input
                          value={s.nome}
                          onChange={(e) => setSpecs((list) => list.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                          placeholder="Rendimento"
                          className="h-9.5 flex-1"
                        />
                        <Input
                          value={s.valor}
                          onChange={(e) => setSpecs((list) => list.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
                          placeholder="10 m²/L"
                          className="h-9.5 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => setSpecs((list) => list.filter((_, j) => j !== i))}
                          aria-label={`Remover ${s.nome}`}
                          className="flex h-8.5 w-8.5 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent text-ink-soft transition-colors hover:text-danger"
                        >
                          <Trash2 size={16} strokeWidth={1.8} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSpecs((list) => [...list, { nome: "", valor: "" }])}
                    className="mt-3.5 cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-medium text-primary"
                  >
                    + Adicionar especificação
                  </button>
                </section>
              </div>

              <div className="sticky top-28 flex min-w-0 flex-col gap-6">
                <section className="rounded-xl border border-border bg-white p-6">
                  <h2 className="m-0 mb-1 text-[17px] font-semibold">Fotos</h2>
                  <p className="mb-4 mt-0 text-[13px] text-ink-soft text-pretty">Arraste para reordenar, ou solte arquivos aqui para enviar. A primeira é a capa na busca do app.</p>
                  <div
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes("Files")) {
                        e.preventDefault();
                        setDragOverZona(true);
                      }
                    }}
                    onDragLeave={() => setDragOverZona(false)}
                    onDrop={(e) => {
                      if (!e.dataTransfer.files.length) return;
                      e.preventDefault();
                      setDragOverZona(false);
                      adicionarFotos(e.dataTransfer.files);
                    }}
                    className={cn(
                      "grid grid-cols-2 gap-2.5 rounded-lg transition-colors",
                      dragOverZona && "outline outline-2 outline-offset-4 outline-primary"
                    )}
                  >
                    {fotos.map((f, i) => (
                      <div
                        key={f.id}
                        draggable
                        onDragStart={() => setDragFoto(f.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!dragFoto || dragFoto === f.id) return;
                          setFotos((list) => {
                            const l = [...list];
                            const from = l.findIndex((x) => x.id === dragFoto);
                            const to = l.findIndex((x) => x.id === f.id);
                            const [x] = l.splice(from, 1);
                            l.splice(to, 0, x);
                            return l;
                          });
                          setDragFoto(null);
                          showToast("Ordem das fotos salva ao clicar em Salvar");
                        }}
                        onDragEnd={() => setDragFoto(null)}
                        className="group relative aspect-square cursor-grab overflow-hidden rounded-lg border border-border bg-paper transition-opacity active:cursor-grabbing"
                        style={{ opacity: dragFoto === f.id ? 0.4 : 1 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt="" className="h-full w-full object-cover" draggable={false} />
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-[rgba(16,24,40,0.55)] px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {i === 0 ? "Capa" : i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFotos((list) => list.filter((x) => x.id !== f.id))}
                          aria-label={`Remover foto ${i + 1}`}
                          className="absolute right-1.5 top-1.5 flex h-5.5 w-5.5 cursor-pointer items-center justify-center rounded-full border-0 bg-[rgba(16,24,40,0.55)] text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    {vagasFoto > 0 && (
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-transparent text-ink-soft disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {uploading ? (
                          <Loader2 size={22} strokeWidth={1.6} className="animate-spin" />
                        ) : (
                          <ImageIcon size={22} strokeWidth={1.6} />
                        )}
                        <span className="text-xs">{uploading ? "Enviando…" : "Adicionar foto"}</span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(",")}
                    multiple
                    hidden
                    onChange={(e) => {
                      if (e.target.files) adicionarFotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <p className="mt-3 text-xs text-ink-soft text-pretty">
                    JPG, PNG ou WEBP, até {MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB. <span className="font-mono">{fotos.length}</span>/8 fotos. O app corta automaticamente para o tamanho de cada tela.
                  </p>
                </section>

                <section className="rounded-xl border border-border bg-white p-6">
                  <h2 className="m-0 mb-4 text-[17px] font-semibold">Preço</h2>
                  <p className="mb-4 text-xs text-ink-soft text-pretty">
                    O preço cadastrado em cada variação (cor/volume) é o <strong>preço a prazo</strong>. O desconto abaixo define o <strong>preço à vista</strong>.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="np-desc-pct" className="text-[13px] font-medium">Desconto à vista</label>
                    <div className="flex items-center gap-2">
                      <Input id="np-desc-pct" type="number" value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} className="w-22.5 font-mono" />
                      <span className="text-sm text-ink-soft">%</span>
                    </div>
                  </div>
                  {desconto > 0 && (
                    <div className="mt-3 flex flex-col gap-1 text-[15px]">
                      <div className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-xs text-ink-soft">À vista</span>
                        <span className="font-mono">{formatBRL(precoMin * (1 - desconto / 100))} – {formatBRL(precoMax * (1 - desconto / 100))}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-xs text-ink-soft">A prazo</span>
                        <span className="font-mono text-ink-soft line-through">{formatBRL(precoMin)} – {formatBRL(precoMax)}</span>
                      </div>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-ink-soft">O desconto à vista vale para todas as variações do produto.</p>
                </section>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={!!confirmarExcluir} onClose={() => setConfirmarExcluir(null)} maxWidth={440}>
        <ModalTitle>{confirmarExcluir?.titulo}</ModalTitle>
        <ModalBody>{confirmarExcluir?.corpo}</ModalBody>
        {confirmarExcluir?.alvo.tipo === "produto" && (
          <p className="mt-2.5 text-sm text-ink-soft text-pretty">Se for só pra tirar da loja, desative o produto em vez de excluir.</p>
        )}
        <div className="mt-5.5 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setConfirmarExcluir(null)}>
            Voltar
          </Button>
          <Button
            variant="danger"
            loading={excluindo}
            onClick={async () => {
              if (!confirmarExcluir) return;
              const { alvo } = confirmarExcluir;
              if (alvo.tipo === "cor") {
                removerCor(alvo.nome);
                setConfirmarExcluir(null);
                return;
              }
              if (alvo.tipo === "volume") {
                removerVolume(alvo.nome);
                setConfirmarExcluir(null);
                return;
              }
              if (alvo.tipo === "paleta") {
                setCores([]);
                setVars({});
                setPaletaTodasCores(alvo.paleta);
                setConfirmarExcluir(null);
                return;
              }
              if (!produtoId) return;
              setExcluindo(true);
              try {
                await deleteDoc(doc(db, "produtos", produtoId));
                setConfirmarExcluir(null);
                setView("lista");
                showToast("Produto excluído");
              } catch {
                showToast("Não deu para excluir. Tente de novo.");
              } finally {
                setExcluindo(false);
              }
            }}
          >
            {confirmarExcluir?.alvo.tipo === "paleta" ? "Trocar" : "Excluir"}
          </Button>
        </div>
      </Modal>
    </main>
  );
}

function ProdutoVariacaoRow({
  cor,
  volumes,
  vars,
  editando,
  precoDraft,
  estoqueDraft,
  limite,
  onCellClick,
  onSalvarCelula,
  onSetPreco,
  onSetEstoque,
  onTogglePausa,
  cellColor,
}: {
  cor: ProdutoCor;
  volumes: string[];
  vars: Record<string, ProdutoVariacao>;
  editando: string | null;
  precoDraft: string;
  estoqueDraft: string;
  limite: number;
  onCellClick: (key: string) => void;
  onSalvarCelula: (key: string) => void;
  onSetPreco: (v: string) => void;
  onSetEstoque: (v: string) => void;
  onTogglePausa: (key: string) => void;
  cellColor: (estoque: number) => string;
}) {
  return (
    <>
      <div className="sticky left-0 z-2 flex items-center gap-2 border-r border-t border-border bg-paper px-3 py-3 text-sm font-medium">
        <span className="h-3.5 w-3.5 shrink-0 rounded-[3px] border border-black/10" style={{ background: cor.hex }} />
        {cor.nome}
      </div>
      {volumes.map((vol) => {
        const key = chave(cor.nome, vol);
        const v = vars[key];
        const isEditing = editando === key;
        const pausada = v?.ativo === false;
        return (
          <div
            key={key}
            role="gridcell"
            tabIndex={0}
            onClick={() => onCellClick(key)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCellClick(key);
              }
            }}
            className="net-cell relative flex min-h-17 cursor-pointer flex-col items-center justify-center gap-0.5 border-t border-l border-border px-3 py-2.5"
          >
            {isEditing ? (
              <div
                className="flex flex-col items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    onSalvarCelula(key);
                  }
                }}
              >
                <div className="flex gap-1.5">
                  <input
                    autoFocus
                    defaultValue={precoDraft}
                    onChange={(e) => onSetPreco(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSalvarCelula(key);
                    }}
                    placeholder="0,00"
                    className="h-7.5 w-15.5 rounded-md border border-border px-2 text-center font-mono text-[13px]"
                  />
                  <input
                    defaultValue={estoqueDraft}
                    onChange={(e) => onSetEstoque(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSalvarCelula(key);
                    }}
                    placeholder="0"
                    className="h-7.5 w-15.5 rounded-md border border-border px-2 text-center font-mono text-[13px]"
                  />
                </div>
                {v && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePausa(key);
                    }}
                    className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[11px] font-medium"
                    style={{ color: pausada ? "#12B76A" : "#B54708" }}
                  >
                    {pausada ? "Reativar" : "Pausar nesta loja"}
                  </button>
                )}
              </div>
            ) : !v ? (
              <>
                <span className="text-[15px] text-border">—</span>
                <span className="net-criar text-xs font-medium text-primary opacity-0 transition-opacity">+ criar</span>
              </>
            ) : pausada ? (
              <>
                <span className="net-pencil absolute right-2 top-2 text-[11px] text-ink-soft opacity-0 transition-opacity">✎</span>
                <span className="font-mono text-[15px] text-[#98A2B3] line-through">{formatBRL(v.preco)}</span>
                <span className="flex items-center gap-1 text-[11px] font-medium text-ink-soft">
                  <span className="h-1.75 w-1.75 rounded-full bg-ink-soft" /> Pausada
                </span>
              </>
            ) : (
              <>
                <span className="net-pencil absolute right-2 top-2 text-[11px] text-ink-soft opacity-0 transition-opacity">✎</span>
                <span className="font-mono text-[15px]">{formatBRL(v.preco)}</span>
                <span className="flex items-center gap-1 font-mono text-[13px]" style={{ color: cellColor(v.estoque) }}>
                  {v.estoque} un
                  {v.estoque < limite && <span className="h-1.75 w-1.75 rounded-full" style={{ background: cellColor(v.estoque) }} />}
                </span>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

function SeletorCorPaleta({
  paleta,
  jaEscolhidas,
  open,
  onOpenChange,
  onEscolher,
  linkCadastro = "/produtos/cores",
}: {
  paleta: CorTinta[];
  jaEscolhidas: ProdutoCor[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEscolher: (cor: CorTinta) => void;
  linkCadastro?: string;
}) {
  const [busca, setBusca] = useState("");
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const buscaNorm = busca.trim().toLowerCase();
  const resultados = useMemo(() => {
    const escolhidasNomes = new Set(jaEscolhidas.map((c) => c.nome));
    const disponiveis = paleta.filter((c) => c.ativa && !escolhidasNomes.has(c.nome));
    if (!buscaNorm) return disponiveis.slice(0, 60);
    return disponiveis
      .filter((c) => c.nome.toLowerCase().includes(buscaNorm) || c.codigo.toLowerCase().includes(buscaNorm))
      .slice(0, 60);
  }, [paleta, jaEscolhidas, buscaNorm]);

  function abrir() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const espacoAbaixo = window.innerHeight - rect.bottom;
    const paraCima = espacoAbaixo < 380;
    setPos({
      left: rect.left,
      ...(paraCima ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
    setBusca("");
    onOpenChange(true);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? onOpenChange(false) : abrir())}
        className="cursor-pointer rounded-full border border-dashed border-border bg-transparent px-3 py-1.5 font-sans text-[13px] text-ink-soft"
      >
        + cor
      </button>
      {open &&
        pos &&
        createPortal(
          <AnimatePresence>
            <div key="cor-picker-backdrop" onClick={() => onOpenChange(false)} className="fixed inset-0 z-40" />
            <motion.div
              key="cor-picker-menu"
              initial={{ opacity: 0, y: pos.bottom !== undefined ? 4 : -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: pos.bottom !== undefined ? 4 : -4, scale: 0.97 }}
              transition={{ duration: 0.14 }}
              style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
              className="fixed z-50 w-80 overflow-hidden rounded-[10px] border border-border bg-white shadow-[0_12px_28px_rgba(16,24,40,0.16)]"
            >
              <div className="border-b border-border p-2.5">
                <Input
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar cor (nome ou código)"
                  className="h-8.5 text-sm"
                />
              </div>
              <div className="max-h-72 overflow-y-auto p-1.5">
                {resultados.length === 0 ? (
                  <p className="p-3 text-center text-[13px] text-ink-soft">
                    Nenhuma cor encontrada.{" "}
                    <Link href={linkCadastro} className="font-medium no-underline">
                      Cadastrar na paleta
                    </Link>
                  </p>
                ) : (
                  resultados.map((cor) => (
                    <button
                      key={cor.id}
                      type="button"
                      onClick={() => {
                        onEscolher(cor);
                        onOpenChange(false);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-2 text-left font-sans"
                    >
                      <span
                        className="h-5 w-5 shrink-0 rounded-[5px] border border-black/10"
                        style={{ background: cor.hex }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{cor.nome}</span>
                      <span className="shrink-0 font-mono text-[11px] text-ink-soft">{cor.codigo}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

const UNIDADES_VOLUME = ["L", "mL", "Kg", "G", "Unid."] as const;

function SeletorVolume({
  jaExistentes,
  open,
  onOpenChange,
  onAdicionar,
}: {
  jaExistentes: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdicionar: (valor: string) => void;
}) {
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState<(typeof UNIDADES_VOLUME)[number]>("L");
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const valorFormatado = quantidade.trim() ? `${quantidade.trim().replace(".", ",")}${unidade}` : "";
  const duplicado = valorFormatado !== "" && jaExistentes.includes(valorFormatado);

  function abrir() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const espacoAbaixo = window.innerHeight - rect.bottom;
    const paraCima = espacoAbaixo < 220;
    setPos({
      left: rect.left,
      ...(paraCima ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
    setQuantidade("");
    setUnidade("L");
    onOpenChange(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function confirmar() {
    if (!valorFormatado || duplicado) return;
    onAdicionar(valorFormatado);
    onOpenChange(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? onOpenChange(false) : abrir())}
        className="cursor-pointer rounded-full border border-dashed border-border bg-transparent px-3 py-1.5 font-sans text-[13px] text-ink-soft"
      >
        + volume
      </button>
      {open &&
        pos &&
        createPortal(
          <AnimatePresence>
            <div key="vol-picker-backdrop" onClick={() => onOpenChange(false)} className="fixed inset-0 z-40" />
            <motion.div
              key="vol-picker-menu"
              initial={{ opacity: 0, y: pos.bottom !== undefined ? 4 : -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: pos.bottom !== undefined ? 4 : -4, scale: 0.97 }}
              transition={{ duration: 0.14 }}
              style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
              className="fixed z-50 w-64 overflow-hidden rounded-[10px] border border-border bg-white p-3 shadow-[0_12px_28px_rgba(16,24,40,0.16)]"
            >
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value.replace(/[^0-9.,]/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && confirmar()}
                  placeholder="Quantidade"
                  inputMode="decimal"
                  className="h-8.5 min-w-0 flex-1 text-sm"
                />
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value as (typeof UNIDADES_VOLUME)[number])}
                  className="h-8.5 shrink-0 rounded-lg border border-border bg-white px-2 text-sm"
                >
                  {UNIDADES_VOLUME.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              {duplicado && <p className="mt-1.5 text-[12px] text-red-600">Esse volume já existe.</p>}
              <Button
                type="button"
                onClick={confirmar}
                disabled={!valorFormatado || duplicado}
                className="mt-2.5 w-full"
              >
                Adicionar {valorFormatado || ""}
              </Button>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
