"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  PaintRoller,
  Paintbrush,
  Droplet,
  Layers,
  Wrench,
  Home,
  Sparkles,
  Sun,
  Package,
  Grid3x3,
  Tag,
  Palette,
  Brush,
  SprayCan,
  Hammer,
  Ruler,
  Building2,
  DoorOpen,
  Fence,
  TreePine,
  Car,
  Warehouse,
  ShowerHead,
  Lightbulb,
  GripVertical,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { addDoc, collection, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal, ModalTitle, ModalBody } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { staggerContainer, staggerItem, cardHover } from "@/lib/animations";
import { useCategorias } from "@/lib/hooks/useCategorias";
import { useCloudinaryUpload } from "@/lib/hooks/useCloudinaryUpload";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/cloudinary";
import type { Categoria } from "@/lib/types";

const ICONES: Record<string, LucideIcon> = {
  roller: PaintRoller,
  brush: Paintbrush,
  brush2: Brush,
  spray: SprayCan,
  droplet: Droplet,
  palette: Palette,
  layers: Layers,
  wrench: Wrench,
  hammer: Hammer,
  ruler: Ruler,
  home: Home,
  building: Building2,
  door: DoorOpen,
  fence: Fence,
  tree: TreePine,
  car: Car,
  warehouse: Warehouse,
  shower: ShowerHead,
  lightbulb: Lightbulb,
  sparkles: Sparkles,
  sun: Sun,
  package: Package,
  grid: Grid3x3,
  tag: Tag,
};

const ICONE_NOMES: Record<string, string> = {
  roller: "Rolo",
  brush: "Pincel",
  brush2: "Pincel fino",
  spray: "Spray",
  droplet: "Gota",
  palette: "Paleta",
  layers: "Camadas",
  wrench: "Ferramenta",
  hammer: "Martelo",
  ruler: "Régua",
  home: "Casa",
  building: "Prédio",
  door: "Porta",
  fence: "Cerca",
  tree: "Jardim",
  car: "Garagem",
  warehouse: "Galpão",
  shower: "Banheiro",
  lightbulb: "Iluminação",
  sparkles: "Brilho",
  sun: "Sol",
  package: "Pacote",
  grid: "Grade",
  tag: "Etiqueta",
};

const ICONE_IDS = Object.keys(ICONES);

export default function CategoriasPage() {
  const { showToast } = useToast();
  const { categorias, loading } = useCategorias();
  const [drag, setDrag] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [iconePicker, setIconePicker] = useState<string | null>(null);
  const [iconePickerPos, setIconePickerPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const [enviandoFotoId, setEnviandoFotoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fotoAlvoRef = useRef<string | null>(null);
  const { upload, uploading } = useCloudinaryUpload({
    folder: "nova-era-tintas/categorias",
    onError: (message) => showToast(message),
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (removendo) setRemovendo(null);
      else if (iconePicker) setIconePicker(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [removendo, iconePicker]);

  async function addCategoria() {
    const nome = novoNome.trim();
    if (!nome) return;
    setCriando(true);
    try {
      const proximaOrdem = categorias.length > 0 ? Math.max(...categorias.map((c) => c.ordem)) + 1 : 0;
      await addDoc(collection(db, "categorias"), {
        nome,
        icone: "tag",
        fundo: "#9AA0A6",
        ordem: proximaOrdem,
        ativa: true,
        qtdProdutos: 0,
      });
      setNova(false);
      setNovoNome("");
      showToast("Categoria criada");
    } catch {
      showToast("Não deu para criar a categoria. Tente de novo.");
    } finally {
      setCriando(false);
    }
  }

  async function atualizar(id: string, patch: Partial<Categoria>) {
    try {
      await updateDoc(doc(db, "categorias", id), patch);
    } catch {
      showToast("Não deu para salvar. Tente de novo.");
    }
  }

  async function trocarFoto(id: string, file: File) {
    setEnviandoFotoId(id);
    try {
      const result = await upload(file);
      if (!result) return;
      await updateDoc(doc(db, "categorias", id), { fotoUrl: result.url });
      showToast("Foto da categoria atualizada");
    } catch {
      showToast("Não deu para salvar a foto. Tente de novo.");
    } finally {
      setEnviandoFotoId(null);
    }
  }

  async function reordenar(fromId: string, toId: string) {
    const from = categorias.findIndex((x) => x.id === fromId);
    const to = categorias.findIndex((x) => x.id === toId);
    if (from === -1 || to === -1) return;
    const lista = [...categorias];
    const [item] = lista.splice(from, 1);
    lista.splice(to, 0, item);
    try {
      const batch = writeBatch(db);
      lista.forEach((c, i) => {
        if (c.ordem !== i) batch.update(doc(db, "categorias", c.id), { ordem: i });
      });
      await batch.commit();
      showToast("Ordem salva");
    } catch {
      showToast("Não deu para salvar a ordem. Tente de novo.");
    }
  }

  const removendoCategoria = removendo ? categorias.find((c) => c.id === removendo) : null;

  return (
    <main className="min-w-0 flex-1 p-10">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="mb-1.5 text-[13px] text-ink-soft">
            <Link href="/produtos" className="no-underline">
              Produtos
            </Link>
            <span className="mx-1.5">/</span>Categorias
          </div>
          <h1 className="m-0 text-[30px] font-semibold tracking-tight">Categorias</h1>
          <p className="mt-1.5 text-[15px] text-ink-soft text-pretty">
            A ordem daqui é a ordem que o cliente vê na tela inicial do app. Arraste para reorganizar.
          </p>
        </div>
        {!nova && (
          <Button
            className="shrink-0"
            onClick={() => {
              setNova(true);
              setNovoNome("");
            }}
          >
            + Nova categoria
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          const alvo = fotoAlvoRef.current;
          fotoAlvoRef.current = null;
          if (file && alvo) trocarFoto(alvo, file);
        }}
      />

      {loading ? (
        <div className="mt-14 flex justify-center">
          <Loader2 size={22} className="animate-spin text-primary" />
        </div>
      ) : (
        <motion.div variants={staggerContainer(0.05)} initial="hidden" animate="visible" className="mt-6 flex max-w-215 flex-col gap-3">
          <AnimatePresence initial={false}>
            {categorias.map((c) => {
              const Icon = ICONES[c.icone] ?? Tag;
              const enviandoEstaFoto = uploading && enviandoFotoId === c.id;
              return (
                <motion.div
                  key={c.id}
                  variants={staggerItem}
                  layout
                  whileHover={cardHover}
                  draggable
                  onDragStart={() => setDrag(c.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!drag || drag === c.id) return;
                    reordenar(drag, c.id);
                    setDrag(null);
                  }}
                  onDragEnd={() => setDrag(null)}
                  className="grid grid-cols-[24px_168px_1fr_auto] items-center gap-4.5 rounded-xl border border-border bg-white p-4 transition-colors"
                  style={{ opacity: drag === c.id ? 0.4 : c.ativa ? 1 : 0.72 }}
                >
                  <GripVertical size={16} className="net-grip cursor-grab justify-self-center text-ink-soft opacity-0 transition-opacity" />

                  <div
                    className="relative flex h-23 w-42 items-end overflow-hidden rounded-[10px] p-2.5"
                    style={{ background: c.fotoUrl ? undefined : c.fundo || "#9AA0A6" }}
                  >
                    {c.fotoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.fotoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(16,24,40,0) 40%, rgba(16,24,40,0.5))" }} />
                    <div className="relative flex items-center gap-1.5 text-white">
                      <Icon size={15} strokeWidth={1.8} />
                      <span className="text-[13px] font-semibold">{c.nome}</span>
                    </div>
                    <button
                      type="button"
                      disabled={enviandoEstaFoto}
                      onClick={() => {
                        fotoAlvoRef.current = c.id;
                        fileInputRef.current?.click();
                      }}
                      className="absolute right-2 top-2 flex cursor-pointer items-center gap-1 rounded-full border-0 bg-white/90 px-2.5 py-1.5 font-sans text-[11px] font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {enviandoEstaFoto && <Loader2 size={11} className="animate-spin" />}
                      Trocar foto
                    </button>
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <Input
                      value={c.nome}
                      onChange={(e) => {
                        const v = e.target.value;
                        atualizar(c.id, { nome: v });
                      }}
                      aria-label={`Nome da categoria ${c.nome}`}
                      className="h-9.5 max-w-80"
                    />
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            if (iconePicker === c.id) {
                              setIconePicker(null);
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            const espacoAbaixo = window.innerHeight - rect.bottom;
                            const paraCima = espacoAbaixo < 340;
                            setIconePickerPos({
                              left: rect.left,
                              ...(paraCima ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
                            });
                            setIconePicker(c.id);
                          }}
                          aria-expanded={iconePicker === c.id}
                          className="flex h-8.5 cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 font-sans text-[13px] text-[#344054]"
                        >
                          <Icon size={16} strokeWidth={1.8} />
                          Ícone
                          <span className="text-[10px] text-ink-soft">▾</span>
                        </button>
                      </div>
                      <span className="text-[13px] text-ink-soft">
                        <span className="font-mono text-ink">{c.qtdProdutos}</span> {c.qtdProdutos === 1 ? "produto" : "produtos"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-self-end gap-3.5">
                    <label className="flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: c.ativa ? "#101828" : "#667085" }}>
                      {c.ativa ? "Ativa" : "Inativa"}
                      <Switch checked={c.ativa} onChange={() => atualizar(c.id, { ativa: !c.ativa })} aria-label={`Ativar/desativar ${c.nome}`} />
                    </label>
                    <button
                      type="button"
                      onClick={() => setRemovendo(c.id)}
                      aria-label={`Excluir categoria ${c.nome}`}
                      className="net-x cursor-pointer border-0 bg-transparent p-1 text-lg leading-none text-ink-soft transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {iconePicker &&
            iconePickerPos &&
            createPortal(
              <AnimatePresence>
                <div
                  key="icone-picker-backdrop"
                  onClick={() => setIconePicker(null)}
                  onWheel={() => setIconePicker(null)}
                  className="fixed inset-0 z-40"
                />
                <motion.div
                  key="icone-picker-menu"
                  initial={{ opacity: 0, y: iconePickerPos.bottom !== undefined ? 4 : -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: iconePickerPos.bottom !== undefined ? 4 : -4, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  style={{ left: iconePickerPos.left, top: iconePickerPos.top, bottom: iconePickerPos.bottom }}
                  data-icone-picker
                  className="fixed z-50 grid max-h-80 w-72 grid-cols-4 gap-2.5 overflow-y-auto rounded-[10px] border border-border bg-white p-3.5 shadow-[0_12px_28px_rgba(16,24,40,0.16)]"
                >
                  {ICONE_IDS.map((id, i) => {
                    const OptIcon = ICONES[id];
                    const categoriaAtual = categorias.find((c) => c.id === iconePicker);
                    const selected = id === categoriaAtual?.icone;
                    return (
                      <motion.button
                        key={id}
                        type="button"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.015 }}
                        whileHover={{ scale: 1.12 }}
                        onClick={() => {
                          if (iconePicker) atualizar(iconePicker, { icone: id });
                          setIconePicker(null);
                        }}
                        aria-label={ICONE_NOMES[id] ?? id}
                        title={ICONE_NOMES[id] ?? id}
                        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg border"
                        style={{
                          borderColor: selected ? "#12B76A" : "#E4E7EC",
                          background: selected ? "#F6FEF9" : "#fff",
                          color: selected ? "#12B76A" : "#344054",
                        }}
                      >
                        <OptIcon size={22} strokeWidth={1.8} />
                      </motion.button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>,
              document.body
            )}

          <AnimatePresence>
            {nova && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 overflow-hidden rounded-xl border border-primary bg-primary-tint p-4.5"
              >
                <Input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCategoria();
                    }
                  }}
                  placeholder="Nome da categoria"
                  autoFocus
                  className="max-w-90 flex-1"
                />
                <Button className="shrink-0" loading={criando} onClick={addCategoria}>
                  Criar
                </Button>
                <button type="button" onClick={() => setNova(false)} className="shrink-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-medium text-ink-soft">
                  Cancelar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <p className="mx-0.5 mt-4 max-w-215 text-[13px] text-ink-soft text-pretty">
        Uma categoria desativada some da tela inicial do app, mas os produtos dela continuam à venda pela busca.
      </p>

      <Modal open={!!removendo} onClose={() => setRemovendo(null)} maxWidth={440}>
        <ModalTitle>Excluir a categoria?</ModalTitle>
        <ModalBody>
          {removendoCategoria && removendoCategoria.qtdProdutos > 0
            ? `Os ${removendoCategoria.qtdProdutos} produtos dela não são apagados — só ficam sem categoria até você reorganizar.`
            : "Ela não tem produtos, então nada mais é afetado."}
        </ModalBody>
        <div className="mt-5.5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setRemovendo(null)}>
            Voltar
          </Button>
          <Button
            variant="danger"
            loading={excluindo}
            onClick={async () => {
              if (!removendo) return;
              setExcluindo(true);
              try {
                await deleteDoc(doc(db, "categorias", removendo));
                showToast("Categoria excluída");
                setRemovendo(null);
              } catch {
                showToast("Não deu para excluir. Tente de novo.");
              } finally {
                setExcluindo(false);
              }
            }}
          >
            Excluir categoria
          </Button>
        </div>
      </Modal>
    </main>
  );
}
