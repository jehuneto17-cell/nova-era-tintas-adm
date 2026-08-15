"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Search, Image as ImageIcon, X, Trash2, Loader2 } from "lucide-react";
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Modal, ModalTitle, ModalBody } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { fadeIn } from "@/lib/animations";
import { formatBRL, cn } from "@/lib/utils";
import { useCloudinaryUpload } from "@/lib/hooks/useCloudinaryUpload";
import { useProdutos } from "@/lib/hooks/useProdutos";
import { useCategorias } from "@/lib/hooks/useCategorias";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/cloudinary";
import type { Produto, ProdutoCor, ProdutoVariacao } from "@/lib/types";

interface Foto {
  id: string;
  url: string;
}

type ExclusaoAlvo = { tipo: "produto" } | { tipo: "cor"; nome: string } | { tipo: "volume"; nome: string };

function chave(cor: string, volume: string) {
  return `${cor}|${volume}`;
}

export default function ProdutosPage() {
  const { showToast } = useToast();
  const { produtos: lista, loading: carregandoLista } = useProdutos();
  const { categorias } = useCategorias();
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
  const [volumes, setVolumes] = useState<string[]>([]);
  const [vars, setVars] = useState<Record<string, ProdutoVariacao>>({});
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
    setVolumes(p.volumes);
    setVars(p.variacoes);
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
    } catch {
      showToast("Não deu para criar o produto. Tente de novo.");
    } finally {
      setCriandoProduto(false);
    }
  }

  async function salvarProduto() {
    if (!produtoId) return;
    setSalvando(true);
    try {
      await setDoc(
        doc(db, "produtos", produtoId),
        {
          nome: produtoNome,
          descricao: produtoDescricao,
          categoriaId: produtoCategoriaId,
          categoria: categoriaNome(produtoCategoriaId),
          limiteEstoqueBaixo: limite,
          descontoPct: desconto,
          cores,
          volumes,
          variacoes: vars,
          specs,
          fotos,
          ativo: produtoAtivo,
          atualizado_em: serverTimestamp(),
        },
        { merge: true }
      );
      showToast("Produto salvo");
      setView("lista");
    } catch {
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
              <Link href="/produtos/categorias" className="ml-auto text-sm font-medium no-underline">
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
                  const swatch = p.cores[0]?.hex ?? "#E4E7EC";
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
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-paper">
                        <span className="h-3.5 w-3.5 rounded-[3px]" style={{ background: swatch }} />
                      </div>
                      <div className="text-sm font-medium">{p.nome}</div>
                      <div className="text-sm text-ink-soft">{p.categoria}</div>
                      <div className="font-mono text-sm text-ink-soft">{Object.keys(p.variacoes).length}</div>
                      <div className="whitespace-nowrap font-mono text-sm">
                        {min === max ? formatBRL(min) : `${formatBRL(min)} – ${formatBRL(max)}`}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 font-mono text-sm" style={{ color: estoque === 0 ? "#D92D20" : estoque < p.limiteEstoqueBaixo ? "#B54708" : "#101828" }}>
                        {estoque}
                        {estoque < p.limiteEstoqueBaixo && <span className="h-2 w-2 rounded-full" style={{ background: estoque === 0 ? "#D92D20" : "#B54708" }} />}
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
                      <Textarea id="np-desc" rows={5} value={produtoDescricao} onChange={(e) => setProdutoDescricao(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="np-lim" className="text-[13px] font-medium">Limite de estoque baixo</label>
                      <div className="flex items-center gap-2">
                        <Input id="np-lim" type="number" value={limite} onChange={(e) => setLimite(Number(e.target.value))} className="w-22.5 font-mono" />
                        <span className="text-sm text-ink-soft">unidades</span>
                      </div>
                      <span className="text-xs text-ink-soft">Abaixo disso, o produto aparece marcado na lista.</span>
                    </div>
                  </div>
                </section>

                <section className="min-w-0 rounded-xl border border-border bg-white p-6">
                  <h2 className="m-0 text-[17px] font-semibold">Variações</h2>
                  <p className="mb-5 mt-1 text-[13px] text-ink-soft">Cada combinação de cor e volume tem preço e estoque próprios.</p>

                  <div className="mb-5 flex flex-wrap gap-7">
                    <div>
                      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-soft">Cores</div>
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
                        <button
                          type="button"
                          onClick={() => setCores((c) => [...c, { nome: `Nova cor ${c.length + 1}`, hex: "#C7C7C7" }])}
                          className="cursor-pointer rounded-full border border-dashed border-border bg-transparent px-3 py-1.5 font-sans text-[13px] text-ink-soft"
                        >
                          + cor
                        </button>
                      </div>
                    </div>
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
                        <button
                          type="button"
                          onClick={() => setVolumes((v) => [...v, `${v.length + 1}L`])}
                          className="cursor-pointer rounded-full border border-dashed border-border bg-transparent px-3 py-1.5 font-sans text-[13px] text-ink-soft"
                        >
                          + volume
                        </button>
                      </div>
                    </div>
                  </div>

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
                  <div className="mt-3 text-[13px] text-ink-soft">
                    {varValues.length} variações · {totalEstoque} unidades no total
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

              <div className="flex min-w-0 flex-col gap-6">
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
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="np-desc-pct" className="text-[13px] font-medium">Desconto</label>
                    <div className="flex items-center gap-2">
                      <Input id="np-desc-pct" type="number" value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} className="w-22.5 font-mono" />
                      <span className="text-sm text-ink-soft">%</span>
                    </div>
                  </div>
                  {desconto > 0 && (
                    <div className="mt-3 font-mono text-[15px]">
                      {formatBRL(precoMin * (1 - desconto / 100))} – {formatBRL(precoMax * (1 - desconto / 100))}
                      <span className="ml-2 text-ink-soft line-through">
                        {formatBRL(precoMin)} – {formatBRL(precoMax)}
                      </span>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-ink-soft">O desconto vale para todas as variações.</p>
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
            Excluir
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
              <div className="flex flex-col items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
