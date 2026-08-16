"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, GripVertical, Loader2, Upload, X } from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input, Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Modal, ModalTitle, ModalBody, ModalActions } from "@/components/ui/Modal";
import { AnimatedSection } from "@/components/ui/Accordion";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { useToast } from "@/components/ui/Toast";
import { staggerContainer, staggerItem, cardHover } from "@/lib/animations";
import { useCloudinaryUpload } from "@/lib/hooks/useCloudinaryUpload";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/cloudinary";
import type { Cupom } from "@/lib/types";

interface PixState {
  tipo: string;
  chave: string;
  recebedor: string;
  instrucoes: string;
  prazo: string;
  qrCodeUrl: string | null;
}
interface WaState {
  numero: string;
  mensagem: string;
}
interface FreteState {
  valor: string;
  gratis: string;
}
interface CupomForm {
  codigo: string;
  tipo: "%" | "R$";
  valor: string;
  inicio: string;
  fim: string;
  limite: string;
}
interface HorarioDia {
  aberto: boolean;
  inicio: string;
  fim: string;
}
interface LojaState {
  nome: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  estado: string;
  horarios: string;
  horariosSemana: HorarioDia[];
}

const SECOES = [
  { id: "pix", nome: "PIX" },
  { id: "whatsapp", nome: "WhatsApp" },
  { id: "frete", nome: "Frete" },
  { id: "recusa", nome: "Motivos de recusa" },
  { id: "cupons", nome: "Cupons" },
  { id: "buscas", nome: "Buscas populares" },
  { id: "loja", nome: "Loja" },
];

const VARIAVEIS = ["{nome}", "{itens}", "{total}", "{pedido}", "{link}"];
const EXEMPLO: Record<string, string> = {
  "{nome}": "Maria Souza",
  "{itens}": "2× Tinta Acrílica Branco Neve 3,6L\n1× Rolo Antigota 23cm",
  "{total}": "R$ 184,50",
  "{pedido}": "#1043",
  "{link}": "novaeratintas.com/p/1043",
};

const PIX_DEFAULT: PixState = { tipo: "CNPJ", chave: "", recebedor: "", instrucoes: "", prazo: "24", qrCodeUrl: null };
const WA_DEFAULT: WaState = { numero: "", mensagem: "" };
const FRETE_DEFAULT: FreteState = { valor: "0,00", gratis: "0,00" };
const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DIAS_ABREV = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HORARIOS_SEMANA_DEFAULT: HorarioDia[] = DIAS_SEMANA.map((_, i) => ({
  aberto: i < 5,
  inicio: "08:00",
  fim: i < 5 ? "18:00" : "13:00",
}));
const LOJA_DEFAULT: LojaState = { nome: "", cnpj: "", endereco: "", cidade: "", estado: "", horarios: "", horariosSemana: HORARIOS_SEMANA_DEFAULT };

function resumoHorarios(dias: HorarioDia[]): string {
  const grupos: { label: string; inicio: string; fim: string; aberto: boolean }[] = [];
  dias.forEach((d, i) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.aberto === d.aberto && ultimo.inicio === d.inicio && ultimo.fim === d.fim) {
      ultimo.label = ultimo.label.includes("-")
        ? `${ultimo.label.split("-")[0]}-${DIAS_ABREV[i]}`
        : `${ultimo.label}-${DIAS_ABREV[i]}`;
    } else {
      grupos.push({ label: DIAS_ABREV[i], inicio: d.inicio, fim: d.fim, aberto: d.aberto });
    }
  });
  return grupos
    .map((g) => (g.aberto ? `${g.label} ${g.inicio}-${g.fim}` : `${g.label} fechado`))
    .join(", ");
}

function fmtDataBr(iso: string) {
  if (!iso) return "—";
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : iso;
}

function paraNumero(v: string) {
  return parseFloat(v.replace(",", ".")) || 0;
}

function paraMoedaStr(n: number) {
  return n.toFixed(2).replace(".", ",");
}

export default function ConfiguracoesPage() {
  const { showToast } = useToast();
  const [secaoAtiva, setSecaoAtiva] = useState("pix");
  const [carregando, setCarregando] = useState(true);

  const [pix, setPix] = useState<PixState>(PIX_DEFAULT);
  const [pixEditing, setPixEditing] = useState(false);
  const [pixSnapshot, setPixSnapshot] = useState<PixState | null>(null);
  const [confirmandoChave, setConfirmandoChave] = useState(false);
  const [salvandoPix, setSalvandoPix] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const { upload: uploadQrCode, uploading: enviandoQrCode } = useCloudinaryUpload({
    folder: "nova-era-tintas/pix",
    onError: (message) => showToast(message),
  });

  const [wa, setWa] = useState<WaState>(WA_DEFAULT);
  const [waEditing, setWaEditing] = useState(false);
  const [waSnapshot, setWaSnapshot] = useState<WaState | null>(null);
  const [salvandoWa, setSalvandoWa] = useState(false);
  const waTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [frete, setFrete] = useState<FreteState>(FRETE_DEFAULT);
  const [freteEditing, setFreteEditing] = useState(false);
  const [freteSnapshot, setFreteSnapshot] = useState<FreteState | null>(null);
  const [salvandoFrete, setSalvandoFrete] = useState(false);

  const [motivos, setMotivos] = useState<string[]>([]);
  const [novoMotivo, setNovoMotivo] = useState("");
  const [removendoMotivo, setRemovendoMotivo] = useState<number | null>(null);
  const dragMotivoRef = useRef<number | null>(null);

  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [cupomNovo, setCupomNovo] = useState(false);
  const [novo, setNovo] = useState<CupomForm>({ codigo: "", tipo: "%", valor: "", inicio: "", fim: "", limite: "" });
  const [salvandoCupom, setSalvandoCupom] = useState(false);
  const [removendoCupomId, setRemovendoCupomId] = useState<string | null>(null);
  const [excluindoCupom, setExcluindoCupom] = useState(false);

  const [buscas, setBuscas] = useState<string[]>([]);
  const [novaBusca, setNovaBusca] = useState("");
  const [mostrarBuscas, setMostrarBuscas] = useState(true);

  const [loja, setLoja] = useState<LojaState>(LOJA_DEFAULT);
  const [lojaEditing, setLojaEditing] = useState(false);
  const [lojaSnapshot, setLojaSnapshot] = useState<LojaState | null>(null);
  const [salvandoLoja, setSalvandoLoja] = useState(false);

  useEffect(() => {
    async function carregar() {
      try {
        const [pagamentoSnap, whatsappSnap, freteSnap, buscasSnap, lojaSnap, cuponsSnap] = await Promise.all([
          getDoc(doc(db, "configuracoes", "pagamento")),
          getDoc(doc(db, "configuracoes", "whatsapp")),
          getDoc(doc(db, "configuracoes", "frete")),
          getDoc(doc(db, "configuracoes", "buscas")),
          getDoc(doc(db, "configuracoes", "loja")),
          getDocs(collection(db, "cupons")),
        ]);

        const pagamento = pagamentoSnap.data();
        if (pagamento) {
          setPix({
            tipo: pagamento.pix_tipo ?? PIX_DEFAULT.tipo,
            chave: pagamento.pix_chave ?? "",
            recebedor: pagamento.pix_recebedor ?? "",
            instrucoes: pagamento.pix_instrucoes ?? "",
            prazo: pagamento.pix_prazo_horas != null ? String(pagamento.pix_prazo_horas) : PIX_DEFAULT.prazo,
            qrCodeUrl: pagamento.pix_qr_url ?? null,
          });
          setMotivos(Array.isArray(pagamento.motivos_recusa) ? pagamento.motivos_recusa : []);
        }

        const whatsapp = whatsappSnap.data();
        if (whatsapp) setWa({ numero: whatsapp.numero ?? "", mensagem: whatsapp.mensagem ?? "" });

        const freteData = freteSnap.data();
        if (freteData) {
          setFrete({
            valor: freteData.valor != null ? paraMoedaStr(freteData.valor) : FRETE_DEFAULT.valor,
            gratis: freteData.gratis_acima != null ? paraMoedaStr(freteData.gratis_acima) : FRETE_DEFAULT.gratis,
          });
        }

        const buscasData = buscasSnap.data();
        if (buscasData) {
          setBuscas(Array.isArray(buscasData.termos) ? buscasData.termos : []);
          setMostrarBuscas(buscasData.mostrar ?? true);
        }

        const lojaData = lojaSnap.data();
        if (lojaData) {
          setLoja({
            nome: lojaData.nome ?? "",
            cnpj: lojaData.cnpj ?? "",
            endereco: lojaData.endereco ?? "",
            cidade: lojaData.cidade ?? "",
            estado: lojaData.estado ?? "",
            horarios: lojaData.horarios ?? "",
            horariosSemana: Array.isArray(lojaData.horarios_semana) && lojaData.horarios_semana.length === 7
              ? lojaData.horarios_semana
              : HORARIOS_SEMANA_DEFAULT,
          });
        }

        setCupons(cuponsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Cupom));
      } catch {
        showToast("Não deu para carregar as configurações.");
      } finally {
        setCarregando(false);
      }
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (carregando) return;
    const alvos = SECOES.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setSecaoAtiva(visible.target.id);
      },
      { rootMargin: "-80px 0px -60% 0px" }
    );
    alvos.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    function onScroll() {
      const scrolledToEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (scrolledToEnd) setSecaoAtiva(alvos[alvos.length - 1]);
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [carregando]);

  const today = new Date().toISOString().slice(0, 10);

  let preview = wa.mensagem;
  for (const k of Object.keys(EXEMPLO)) preview = preview.split(k).join(EXEMPLO[k]);

  async function salvarPagamento(patch: Record<string, unknown>) {
    await setDoc(doc(db, "configuracoes", "pagamento"), { ...patch, atualizado_em: serverTimestamp() }, { merge: true });
  }

  async function confirmarSalvarPix() {
    setSalvandoPix(true);
    try {
      await salvarPagamento({
        pix_tipo: pix.tipo,
        pix_chave: pix.chave,
        pix_recebedor: pix.recebedor,
        pix_instrucoes: pix.instrucoes,
        pix_prazo_horas: Number(pix.prazo) || 0,
        pix_qr_url: pix.qrCodeUrl,
      });
      setPixEditing(false);
      showToast("PIX salvo");
    } catch {
      showToast("Não deu para salvar o PIX. Tente de novo.");
    } finally {
      setSalvandoPix(false);
    }
  }

  async function salvarWhatsapp() {
    setSalvandoWa(true);
    try {
      await setDoc(doc(db, "configuracoes", "whatsapp"), { ...wa, atualizado_em: serverTimestamp() }, { merge: true });
      setWaEditing(false);
      showToast("WhatsApp salvo");
    } catch {
      showToast("Não deu para salvar. Tente de novo.");
    } finally {
      setSalvandoWa(false);
    }
  }

  async function salvarFrete() {
    setSalvandoFrete(true);
    try {
      await setDoc(
        doc(db, "configuracoes", "frete"),
        { valor: paraNumero(frete.valor), gratis_acima: paraNumero(frete.gratis), atualizado_em: serverTimestamp() },
        { merge: true }
      );
      setFreteEditing(false);
      showToast("Frete salvo");
    } catch {
      showToast("Não deu para salvar. Tente de novo.");
    } finally {
      setSalvandoFrete(false);
    }
  }

  async function salvarLoja() {
    setSalvandoLoja(true);
    try {
      const { horariosSemana, ...resto } = loja;
      await setDoc(
        doc(db, "configuracoes", "loja"),
        { ...resto, horarios: resumoHorarios(horariosSemana), horarios_semana: horariosSemana, atualizado_em: serverTimestamp() },
        { merge: true }
      );
      setLojaEditing(false);
      showToast("Loja salva");
    } catch {
      showToast("Não deu para salvar. Tente de novo.");
    } finally {
      setSalvandoLoja(false);
    }
  }

  async function addMotivo() {
    const t = novoMotivo.trim();
    if (!t) return;
    const next = [...motivos, t];
    try {
      await salvarPagamento({ motivos_recusa: next });
      setMotivos(next);
      setNovoMotivo("");
      showToast("Motivo adicionado");
    } catch {
      showToast("Não deu para salvar. Tente de novo.");
    }
  }

  async function reordenarMotivos(from: number, to: number) {
    const next = [...motivos];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    try {
      await salvarPagamento({ motivos_recusa: next });
      setMotivos(next);
      showToast("Ordem salva");
    } catch {
      showToast("Não deu para salvar a ordem. Tente de novo.");
    }
  }

  async function removerMotivo(index: number) {
    const next = motivos.filter((_, j) => j !== index);
    try {
      await salvarPagamento({ motivos_recusa: next });
      setMotivos(next);
      showToast("Motivo removido");
    } catch {
      showToast("Não deu para remover. Tente de novo.");
    }
  }

  async function salvarCupom() {
    if (!novo.codigo.trim() || !novo.valor.trim()) {
      showToast("Preencha código e desconto");
      return;
    }
    setSalvandoCupom(true);
    try {
      const payload = {
        codigo: novo.codigo.trim().toUpperCase(),
        tipo: novo.tipo,
        valor: paraNumero(novo.valor),
        inicio: novo.inicio,
        fim: novo.fim,
        limite: novo.limite.trim() ? Number(novo.limite) : null,
        usos: 0,
        ativo: true,
      };
      const ref = await addDoc(collection(db, "cupons"), payload);
      setCupons((c) => [...c, { id: ref.id, ...payload }]);
      setCupomNovo(false);
      setNovo({ codigo: "", tipo: "%", valor: "", inicio: "", fim: "", limite: "" });
      showToast("Cupom criado");
    } catch {
      showToast("Não deu para criar o cupom. Tente de novo.");
    } finally {
      setSalvandoCupom(false);
    }
  }

  async function toggleCupom(id: string, ativo: boolean) {
    try {
      await updateDoc(doc(db, "cupons", id), { ativo });
      setCupons((list) => list.map((c) => (c.id === id ? { ...c, ativo } : c)));
    } catch {
      showToast("Não deu para atualizar o cupom. Tente de novo.");
    }
  }

  const cupomRemovendo = removendoCupomId ? cupons.find((c) => c.id === removendoCupomId) : null;

  return (
    <main className="min-w-0 flex-1 p-10">
      <h1 className="m-0 text-[30px] font-semibold tracking-tight">Configurações</h1>
      <p className="mb-7 mt-1.5 text-[15px] text-ink-soft">Os valores que a loja usa no dia a dia.</p>

      {carregando ? (
        <div className="mt-14 flex justify-center">
          <Loader2 size={22} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[180px_minmax(0,720px)]">
          <nav className="sticky top-10 hidden flex-col gap-0.5 lg:flex">
            {SECOES.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="relative py-1.5 pl-3 text-sm no-underline transition-colors duration-150"
                style={{
                  color: secaoAtiva === s.id ? "#101828" : "#667085",
                  fontWeight: secaoAtiva === s.id ? 600 : 400,
                }}
              >
                {secaoAtiva === s.id && (
                  <motion.span
                    layoutId="indice-barra"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    className="absolute inset-y-0 left-0 w-0.5 bg-primary"
                  />
                )}
                {s.nome}
              </a>
            ))}
          </nav>

          <div className="flex min-w-0 flex-col gap-6">
            {/* PIX */}
            <SettingsCard
              id="pix"
              title="PIX"
              description="A chave e o QR Code que o cliente vê na hora de pagar."
              editable
              editing={pixEditing}
              onEdit={() => {
                setPixSnapshot(pix);
                setPixEditing(true);
              }}
            >
              <div className="mt-5.5 grid grid-cols-1 items-start gap-7 md:grid-cols-[58fr_42fr]">
                <div className="flex min-w-0 flex-col gap-4">
                  {!pixEditing ? (
                    <div className="flex flex-col gap-4">
                      <Field label="Tipo de chave" value={pix.tipo} />
                      <Field label="Chave PIX" value={pix.chave} mono size="lg" />
                      <Field label="Nome do recebedor" value={pix.recebedor} />
                      <div>
                        <div className="text-[13px] text-ink-soft">QR Code</div>
                        {pix.qrCodeUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pix.qrCodeUrl} alt="QR Code do PIX" className="mt-1.5 h-24 w-24 rounded-md border border-border object-contain p-1" />
                        ) : (
                          <div className="mt-0.5 text-[15px] text-ink-soft">Não enviado</div>
                        )}
                      </div>
                      <Field label="Prazo para enviar o comprovante" value={<><span className="font-mono">{pix.prazo}</span> horas</>} />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="pix-tipo" className="text-[13px] font-medium">Tipo de chave</label>
                        <select
                          id="pix-tipo"
                          value={pix.tipo}
                          onChange={(e) => setPix((p) => ({ ...p, tipo: e.target.value }))}
                          className="h-10.5 w-full rounded-lg border border-border bg-white px-3.5 text-[15px]"
                        >
                          {["CNPJ", "CPF", "Celular", "Email", "Aleatória"].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="pix-chave" className="text-[13px] font-medium">Chave PIX</label>
                        <div className="flex gap-2">
                          <Input id="pix-chave" value={pix.chave} onChange={(e) => setPix((p) => ({ ...p, chave: e.target.value }))} className="font-mono text-base" />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(pix.chave);
                              showToast("Chave copiada");
                            }}
                            aria-label="Copiar chave"
                            className="flex h-10.5 w-10.5 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-ink-soft"
                          >
                            <Copy size={16} strokeWidth={1.8} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="pix-receb" className="text-[13px] font-medium">Nome do recebedor</label>
                        <Input id="pix-receb" value={pix.recebedor} onChange={(e) => setPix((p) => ({ ...p, recebedor: e.target.value }))} />
                        <span className="text-xs text-ink-soft">O cliente confere este nome no app do banco antes de pagar.</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-medium">QR Code</span>
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-30 w-30 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border p-2 text-center">
                            {pix.qrCodeUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={pix.qrCodeUrl} alt="QR Code do PIX" className="h-full w-full object-contain" />
                            ) : (
                              <div className="flex flex-col items-center gap-1.5 text-ink-soft">
                                <Upload size={18} strokeWidth={1.7} />
                                <span className="text-xs text-pretty">Envie a imagem do QR Code</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-start gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9"
                              loading={enviandoQrCode}
                              onClick={() => qrInputRef.current?.click()}
                            >
                              {pix.qrCodeUrl ? "Trocar QR Code" : "Enviar QR Code"}
                            </Button>
                            <input
                              ref={qrInputRef}
                              type="file"
                              accept={ACCEPTED_IMAGE_TYPES.join(",")}
                              hidden
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (!file) return;
                                const result = await uploadQrCode(file);
                                if (result) setPix((p) => ({ ...p, qrCodeUrl: result.url }));
                              }}
                            />
                            {pix.qrCodeUrl && (
                              <button
                                type="button"
                                onClick={() => setPix((p) => ({ ...p, qrCodeUrl: null }))}
                                className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-danger"
                              >
                                Remover
                              </button>
                            )}
                            <span className="text-xs text-ink-soft">PNG ou JPG.</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="pix-inst" className="text-[13px] font-medium">Instruções para o cliente</label>
                        <Textarea id="pix-inst" rows={3} value={pix.instrucoes} onChange={(e) => setPix((p) => ({ ...p, instrucoes: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="pix-prazo" className="text-[13px] font-medium">Prazo para enviar o comprovante</label>
                        <div className="flex items-center gap-2">
                          <Input id="pix-prazo" type="number" value={pix.prazo} onChange={(e) => setPix((p) => ({ ...p, prazo: e.target.value }))} className="w-22.5 font-mono" />
                          <span className="text-sm text-ink-soft">horas</span>
                        </div>
                        <span className="text-xs text-ink-soft">Depois disso o pedido aparece como atrasado na sua lista.</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="mb-2.5 text-xs font-medium uppercase tracking-wider text-ink-soft">O que o cliente vê</div>
                  <div className="flex w-60 max-w-full flex-col items-center gap-3 rounded-[20px] border-8 border-ink bg-white px-3.5 py-4.5" style={{ aspectRatio: "9 / 19" }}>
                    <div className="text-[15px] font-semibold">Pague com PIX</div>
                    <div className="flex h-27 w-27 shrink-0 items-center justify-center rounded-md border border-border bg-[#F2F2F0] text-[11px] text-ink-soft">
                      {pix.qrCodeUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pix.qrCodeUrl} alt="QR Code do PIX" className="h-full w-full rounded-md object-contain p-1" />
                      ) : (
                        "Sem QR Code"
                      )}
                    </div>
                    <div className="break-all text-center font-mono text-xs">{pix.chave}</div>
                    <div className="rounded-md border border-border px-3 py-1.5 text-xs font-medium">Copiar chave</div>
                    <div className="text-center text-[13px] text-ink-soft">{pix.recebedor}</div>
                    <div className="text-center text-xs text-ink-soft text-pretty">{pix.instrucoes}</div>
                  </div>
                </div>
              </div>

              <AnimatedSection show={pixEditing}>
                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (pixSnapshot) setPix(pixSnapshot);
                      setPixEditing(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="h-9.5"
                    loading={salvandoPix}
                    onClick={() => {
                      if (pixSnapshot && pixSnapshot.chave !== pix.chave) setConfirmandoChave(true);
                      else confirmarSalvarPix();
                    }}
                  >
                    Salvar
                  </Button>
                </div>
              </AnimatedSection>
            </SettingsCard>

            {/* WhatsApp */}
            <SettingsCard
              id="whatsapp"
              title="WhatsApp"
              description="O número da loja e a mensagem que sai junto com o pedido fechado."
              editable
              editing={waEditing}
              onEdit={() => {
                setWaSnapshot(wa);
                setWaEditing(true);
              }}
            >
              {!waEditing ? (
                <div className="mt-5.5 flex flex-col gap-4">
                  <Field label="Número da loja" value={wa.numero} mono />
                  <div>
                    <div className="text-[13px] text-ink-soft">Mensagem do pedido fechado</div>
                    <div className="mt-0.5 whitespace-pre-wrap text-[15px] text-pretty">{wa.mensagem}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-5.5 flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="wa-num" className="text-[13px] font-medium">Número da loja</label>
                    <Input id="wa-num" value={wa.numero} onChange={(e) => setWa((w) => ({ ...w, numero: e.target.value }))} className="font-mono" placeholder="(35) 99999-9999" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="wa-msg" className="text-[13px] font-medium">Mensagem do pedido fechado</label>
                    <div className="flex flex-wrap gap-1.5">
                      {VARIAVEIS.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => {
                            const ta = waTextareaRef.current;
                            const pos = ta ? ta.selectionStart : wa.mensagem.length;
                            const m = wa.mensagem.slice(0, pos) + v + wa.mensagem.slice(pos);
                            setWa((w) => ({ ...w, mensagem: m }));
                          }}
                          className="cursor-pointer rounded-md border border-border bg-paper px-2.5 py-1 font-sans text-xs font-medium text-ink-soft"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <Textarea id="wa-msg" ref={waTextareaRef} rows={6} value={wa.mensagem} onChange={(e) => setWa((w) => ({ ...w, mensagem: e.target.value }))} className="text-sm" />
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-soft">Como vai chegar</div>
                    <div className="whitespace-pre-wrap rounded-lg border border-border bg-paper p-4 text-sm text-pretty">{preview}</div>
                  </div>
                </div>
              )}
              <AnimatedSection show={waEditing}>
                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (waSnapshot) setWa(waSnapshot);
                      setWaEditing(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button className="h-9.5" loading={salvandoWa} onClick={salvarWhatsapp}>
                    Salvar
                  </Button>
                </div>
              </AnimatedSection>
            </SettingsCard>

            {/* Frete */}
            <SettingsCard
              id="frete"
              title="Frete"
              description="Quanto custa entregar e a partir de quanto sai de graça."
              editable
              editing={freteEditing}
              onEdit={() => {
                setFreteSnapshot(frete);
                setFreteEditing(true);
              }}
            >
              <div className="mt-5.5 grid grid-cols-1 gap-5 md:grid-cols-2">
                {!freteEditing ? (
                  <>
                    <Field label="Valor do frete" value={`R$ ${frete.valor}`} mono />
                    <Field label="Frete grátis a partir de" value={`R$ ${frete.gratis}`} mono />
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="fr-v" className="text-[13px] font-medium">Valor do frete</label>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[15px] text-ink-soft">R$</span>
                        <Input id="fr-v" value={frete.valor} onChange={(e) => setFrete((f) => ({ ...f, valor: e.target.value }))} className="font-mono" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="fr-g" className="text-[13px] font-medium">Frete grátis a partir de</label>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[15px] text-ink-soft">R$</span>
                        <Input id="fr-g" value={frete.gratis} onChange={(e) => setFrete((f) => ({ ...f, gratis: e.target.value }))} className="font-mono" />
                      </div>
                      <span className="text-xs text-ink-soft">O app mostra uma barra de progresso pro cliente até esse valor.</span>
                    </div>
                  </>
                )}
              </div>
              <AnimatedSection show={freteEditing}>
                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (freteSnapshot) setFrete(freteSnapshot);
                      setFreteEditing(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button className="h-9.5" loading={salvandoFrete} onClick={salvarFrete}>
                    Salvar
                  </Button>
                </div>
              </AnimatedSection>
            </SettingsCard>

            {/* Motivos de recusa */}
            <section id="recusa">
              <div className="rounded-xl border border-border bg-white p-7">
                <h2 className="m-0 text-lg font-semibold">Motivos de recusa</h2>
                <p className="mt-1 text-sm text-ink-soft">As opções que aparecem quando você recusa um comprovante na Conferência.</p>
                <motion.div variants={staggerContainer(0.04)} initial="hidden" animate="visible" className="mt-4.5 border-t border-border">
                  {motivos.map((m, i) => (
                    <motion.div
                      key={m + i}
                      variants={staggerItem}
                      draggable
                      onDragStart={() => {
                        dragMotivoRef.current = i;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = dragMotivoRef.current;
                        if (from === null || from === i) return;
                        reordenarMotivos(from, i);
                      }}
                      className="group flex items-center gap-2.5 border-b border-border py-3"
                    >
                      <GripVertical size={14} className="cursor-grab text-ink-soft opacity-0 transition-opacity group-hover:opacity-100" />
                      <span className="flex-1 text-[15px]">{m}</span>
                      <button
                        type="button"
                        onClick={() => setRemovendoMotivo(i)}
                        aria-label={`Remover ${m}`}
                        className="cursor-pointer rounded border-0 bg-transparent p-1 text-lg leading-none text-ink-soft transition-colors hover:text-danger"
                      >
                        <X size={16} />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
                <div className="mt-4 flex items-center gap-2.5">
                  <Input
                    value={novoMotivo}
                    onChange={(e) => setNovoMotivo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addMotivo();
                      }
                    }}
                    placeholder="Adicionar motivo"
                  />
                  <button type="button" onClick={addMotivo} className="shrink-0 cursor-pointer border-0 bg-transparent font-sans text-sm font-medium text-primary">
                    Adicionar
                  </button>
                </div>
              </div>
              <p className="mx-0.5 mt-2.5 text-[13px] text-ink-soft text-pretty">
                O campo de texto livre está sempre disponível na Conferência, mesmo sem motivos cadastrados aqui.
              </p>
            </section>

            {/* Cupons */}
            <SettingsCard
              id="cupons"
              title="Cupons"
              description="Os códigos de desconto que o cliente digita no carrinho."
              headerRight={
                !cupomNovo && (
                  <button
                    type="button"
                    onClick={() => {
                      setCupomNovo(true);
                      setNovo({ codigo: "", tipo: "%", valor: "", inicio: "", fim: "", limite: "" });
                    }}
                    className="shrink-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-medium text-primary"
                  >
                    + Novo cupom
                  </button>
                )
              }
            >
              {cupons.length > 0 ? (
                <motion.div variants={staggerContainer(0.05)} initial="hidden" animate="visible" className="mt-5 flex flex-col gap-3">
                  {cupons.map((c) => {
                    const expirado = c.fim && c.fim < today;
                    const status = !c.ativo
                      ? { t: "Pausado", cor: "#667085" }
                      : expirado
                        ? { t: "Expirado", cor: "#B54708" }
                        : { t: "Ativo", cor: "#12B76A" };
                    return (
                      <motion.div
                        key={c.id}
                        variants={staggerItem}
                        whileHover={cardHover}
                        style={{ opacity: c.ativo ? 1 : 0.6 }}
                        className="flex items-center gap-4.5 rounded-[10px] border border-border p-4.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-base font-medium tracking-wide">{c.codigo}</span>
                            <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: status.cor }}>
                              <span className="h-1.75 w-1.75 rounded-full" style={{ background: status.cor }} />
                              {status.t}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft">
                            <span className="font-medium text-ink">
                              <span className="font-mono">{c.tipo === "%" ? `${c.valor}%` : `R$ ${paraMoedaStr(c.valor)}`}</span> de desconto
                            </span>
                            <span>{fmtDataBr(c.inicio)} a {fmtDataBr(c.fim)}</span>
                            <span>
                              <span className="font-mono">{c.limite ? `${c.usos}/${c.limite}` : c.usos}</span> usados
                            </span>
                          </div>
                        </div>
                        <Switch checked={c.ativo} onChange={() => toggleCupom(c.id, !c.ativo)} aria-label={`Ativar/pausar ${c.codigo}`} />
                        <button
                          type="button"
                          onClick={() => setRemovendoCupomId(c.id)}
                          aria-label={`Remover cupom ${c.codigo}`}
                          className="shrink-0 cursor-pointer rounded border-0 bg-transparent p-1 text-lg leading-none text-ink-soft transition-colors hover:text-danger"
                        >
                          <X size={18} />
                        </button>
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
                <div className="mt-5 rounded-[10px] border border-dashed border-border p-7 text-center">
                  <p className="m-0 text-sm text-ink-soft text-pretty">Nenhum cupom ativo. Crie um código pra dar desconto numa promoção.</p>
                </div>
              )}

              <AnimatePresence>
                {cupomNovo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4.5 overflow-hidden rounded-[10px] border border-primary bg-primary-tint p-5"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="cp-cod" className="text-[13px] font-medium">Código</label>
                        <Input
                          id="cp-cod"
                          value={novo.codigo}
                          onChange={(e) => setNovo((n) => ({ ...n, codigo: e.target.value }))}
                          placeholder="PROMO10"
                          className="font-mono uppercase"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-medium">Desconto</label>
                        <div className="flex gap-2">
                          <select
                            value={novo.tipo}
                            onChange={(e) => setNovo((n) => ({ ...n, tipo: e.target.value as "%" | "R$" }))}
                            className="h-10 w-20 rounded-lg border border-border bg-white px-2 text-sm"
                          >
                            <option>%</option>
                            <option>R$</option>
                          </select>
                          <Input value={novo.valor} onChange={(e) => setNovo((n) => ({ ...n, valor: e.target.value }))} placeholder="10" className="font-mono" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="cp-ini" className="text-[13px] font-medium">Início</label>
                        <Input id="cp-ini" type="date" value={novo.inicio} onChange={(e) => setNovo((n) => ({ ...n, inicio: e.target.value }))} className="font-mono" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="cp-fim" className="text-[13px] font-medium">Fim</label>
                        <Input id="cp-fim" type="date" value={novo.fim} onChange={(e) => setNovo((n) => ({ ...n, fim: e.target.value }))} className="font-mono" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="cp-lim" className="text-[13px] font-medium">Limite de usos</label>
                        <Input id="cp-lim" type="number" value={novo.limite} onChange={(e) => setNovo((n) => ({ ...n, limite: e.target.value }))} placeholder="Sem limite" className="font-mono" />
                      </div>
                    </div>
                    <div className="mt-4.5 flex justify-end gap-3">
                      <Button variant="ghost" onClick={() => setCupomNovo(false)}>
                        Cancelar
                      </Button>
                      <Button className="h-9.5" loading={salvandoCupom} onClick={salvarCupom}>
                        Criar cupom
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </SettingsCard>

            {/* Buscas populares */}
            <SettingsCard
              id="buscas"
              title="Buscas populares"
              description="Os termos sugeridos na busca do app."
              headerRight={
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-ink-soft">
                  Mostrar no app
                  <Switch
                    checked={mostrarBuscas}
                    onChange={async () => {
                      const next = !mostrarBuscas;
                      setMostrarBuscas(next);
                      try {
                        await setDoc(doc(db, "configuracoes", "buscas"), { termos: buscas, mostrar: next, atualizado_em: serverTimestamp() }, { merge: true });
                      } catch {
                        showToast("Não deu para salvar. Tente de novo.");
                      }
                    }}
                    aria-label="Mostrar buscas no app"
                  />
                </label>
              }
            >
              <motion.div variants={staggerContainer(0.04)} initial="hidden" animate="visible" className="mt-5 flex flex-wrap items-center gap-2">
                {buscas.map((b, i) => (
                  <motion.span
                    key={b + i}
                    variants={staggerItem}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-paper px-3 py-1.5 text-sm"
                  >
                    {b}
                    <button
                      type="button"
                      onClick={async () => {
                        const next = buscas.filter((_, j) => j !== i);
                        setBuscas(next);
                        try {
                          await setDoc(doc(db, "configuracoes", "buscas"), { termos: next, mostrar: mostrarBuscas, atualizado_em: serverTimestamp() }, { merge: true });
                        } catch {
                          showToast("Não deu para salvar. Tente de novo.");
                        }
                      }}
                      aria-label={`Remover ${b}`}
                      className="cursor-pointer border-0 bg-transparent p-0 text-sm leading-none text-ink-soft transition-colors hover:text-danger"
                    >
                      <X size={13} />
                    </button>
                  </motion.span>
                ))}
                <Input
                  value={novaBusca}
                  onChange={(e) => setNovaBusca(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const t = novaBusca.trim();
                    if (!t) return;
                    const next = [...buscas, t];
                    setBuscas(next);
                    setNovaBusca("");
                    try {
                      await setDoc(doc(db, "configuracoes", "buscas"), { termos: next, mostrar: mostrarBuscas, atualizado_em: serverTimestamp() }, { merge: true });
                      showToast("Termo adicionado");
                    } catch {
                      showToast("Não deu para salvar. Tente de novo.");
                    }
                  }}
                  placeholder="Adicionar termo"
                  className="h-8.5 w-42.5 rounded-full text-sm"
                />
              </motion.div>
            </SettingsCard>

            {/* Loja */}
            <SettingsCard
              id="loja"
              title="Loja"
              description="Os dados que aparecem pro cliente."
              editable
              editing={lojaEditing}
              onEdit={() => {
                setLojaSnapshot(loja);
                setLojaEditing(true);
              }}
            >
              {!lojaEditing ? (
                <div className="mt-5.5 grid grid-cols-1 gap-4.5 sm:grid-cols-2">
                  <Field label="Nome da loja" value={loja.nome} />
                  <Field label="CNPJ" value={loja.cnpj} mono />
                  <div className="sm:col-span-2">
                    <Field label="Endereço" value={loja.endereco} />
                  </div>
                  <Field label="Cidade" value={loja.cidade} />
                  <Field label="Estado" value={loja.estado} />
                  <div className="sm:col-span-2">
                    <Field label="Horário de funcionamento" value={resumoHorarios(loja.horariosSemana)} />
                  </div>
                </div>
              ) : (
                <div className="mt-5.5 grid grid-cols-1 gap-4.5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="lj-nome" className="text-[13px] font-medium">Nome da loja</label>
                    <Input id="lj-nome" value={loja.nome} onChange={(e) => setLoja((l) => ({ ...l, nome: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="lj-cnpj" className="text-[13px] font-medium">CNPJ</label>
                    <Input id="lj-cnpj" value={loja.cnpj} onChange={(e) => setLoja((l) => ({ ...l, cnpj: e.target.value }))} className="font-mono" />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label htmlFor="lj-end" className="text-[13px] font-medium">Endereço</label>
                    <Input id="lj-end" value={loja.endereco} onChange={(e) => setLoja((l) => ({ ...l, endereco: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="lj-cid" className="text-[13px] font-medium">Cidade</label>
                    <Input id="lj-cid" value={loja.cidade} onChange={(e) => setLoja((l) => ({ ...l, cidade: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="lj-uf" className="text-[13px] font-medium">Estado</label>
                    <Input id="lj-uf" value={loja.estado} onChange={(e) => setLoja((l) => ({ ...l, estado: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label className="text-[13px] font-medium">Horário de funcionamento</label>
                    <div className="flex flex-col gap-2 rounded-2xl border border-black/5 p-3.5">
                      {DIAS_SEMANA.map((dia, i) => {
                        const h = loja.horariosSemana[i];
                        return (
                          <div key={dia} className="flex flex-wrap items-center gap-3">
                            <span className="w-22 shrink-0 text-[13px] font-medium">{dia}</span>
                            {h.aberto ? (
                              <>
                                <Input
                                  type="time"
                                  value={h.inicio}
                                  onChange={(e) =>
                                    setLoja((l) => ({
                                      ...l,
                                      horariosSemana: l.horariosSemana.map((d, idx) => (idx === i ? { ...d, inicio: e.target.value } : d)),
                                    }))
                                  }
                                  className="h-9 w-28"
                                />
                                <span className="text-[13px] text-black/40">às</span>
                                <Input
                                  type="time"
                                  value={h.fim}
                                  onChange={(e) =>
                                    setLoja((l) => ({
                                      ...l,
                                      horariosSemana: l.horariosSemana.map((d, idx) => (idx === i ? { ...d, fim: e.target.value } : d)),
                                    }))
                                  }
                                  className="h-9 w-28"
                                />
                              </>
                            ) : (
                              <span className="text-[13px] text-black/40">Fechado</span>
                            )}
                            <label className="ml-auto flex items-center gap-1.5 text-[13px] text-black/60">
                              <input
                                type="checkbox"
                                checked={!h.aberto}
                                onChange={(e) =>
                                  setLoja((l) => ({
                                    ...l,
                                    horariosSemana: l.horariosSemana.map((d, idx) => (idx === i ? { ...d, aberto: !e.target.checked } : d)),
                                  }))
                                }
                              />
                              Fechado
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              <AnimatedSection show={lojaEditing}>
                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (lojaSnapshot) setLoja(lojaSnapshot);
                      setLojaEditing(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button className="h-9.5" loading={salvandoLoja} onClick={salvarLoja}>
                    Salvar
                  </Button>
                </div>
              </AnimatedSection>
            </SettingsCard>
          </div>
        </div>
      )}

      <Modal open={confirmandoChave} onClose={() => setConfirmandoChave(false)} maxWidth={440}>
        <div className="text-center">
          <ModalTitle>Confirme a chave PIX</ModalTitle>
          <div className="mt-4.5 break-all font-mono text-2xl">{pix.chave}</div>
          <div className="mt-1 text-[13px] text-ink-soft">{pix.tipo}</div>
          <ModalBody>O dinheiro dos seus clientes vai pra esta chave. Confere?</ModalBody>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="ghost" onClick={() => setConfirmandoChave(false)}>
              Voltar e revisar
            </Button>
            <Button
              loading={salvandoPix}
              onClick={async () => {
                setConfirmandoChave(false);
                await confirmarSalvarPix();
              }}
            >
              Sim, é esta
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={removendoMotivo !== null} onClose={() => setRemovendoMotivo(null)} maxWidth={420}>
        <ModalTitle>{removendoMotivo !== null ? `Remover "${motivos[removendoMotivo]}"?` : ""}</ModalTitle>
        <ModalBody>Ele some do menu da Conferência. Você pode cadastrar de novo depois.</ModalBody>
        <ModalActions>
          <Button variant="secondary" onClick={() => setRemovendoMotivo(null)}>
            Voltar
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (removendoMotivo === null) return;
              await removerMotivo(removendoMotivo);
              setRemovendoMotivo(null);
            }}
          >
            Remover motivo
          </Button>
        </ModalActions>
      </Modal>

      <Modal open={!!removendoCupomId} onClose={() => setRemovendoCupomId(null)} maxWidth={420}>
        <ModalTitle>{cupomRemovendo ? `Remover o cupom ${cupomRemovendo.codigo}?` : ""}</ModalTitle>
        <ModalBody>O código deixa de funcionar no carrinho do app. Isso não volta atrás.</ModalBody>
        <ModalActions>
          <Button variant="secondary" onClick={() => setRemovendoCupomId(null)}>
            Voltar
          </Button>
          <Button
            variant="danger"
            loading={excluindoCupom}
            onClick={async () => {
              if (!removendoCupomId) return;
              setExcluindoCupom(true);
              try {
                await deleteDoc(doc(db, "cupons", removendoCupomId));
                setCupons((list) => list.filter((c) => c.id !== removendoCupomId));
                showToast("Cupom removido");
                setRemovendoCupomId(null);
              } catch {
                showToast("Não deu para remover. Tente de novo.");
              } finally {
                setExcluindoCupom(false);
              }
            }}
          >
            Remover cupom
          </Button>
        </ModalActions>
      </Modal>
    </main>
  );
}

function Field({ label, value, mono, size }: { label: string; value: React.ReactNode; mono?: boolean; size?: "lg" }) {
  return (
    <div>
      <div className="text-[13px] text-ink-soft">{label}</div>
      <div className={`mt-0.5 ${size === "lg" ? "text-base" : "text-[15px]"} ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
