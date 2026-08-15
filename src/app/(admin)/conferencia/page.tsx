"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ImageOff, Loader2, Upload } from "lucide-react";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Modal, ModalTitle, ModalBody } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { drawerContent, fadeIn } from "@/lib/animations";
import { formatBRL, cn } from "@/lib/utils";
import { usePedidosAguardandoConfirmacao } from "@/lib/hooks/usePedidosAguardandoConfirmacao";
import { useCloudinaryUpload } from "@/lib/hooks/useCloudinaryUpload";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/cloudinary";
import type { Pedido } from "@/lib/types";

export default function ConferenciaPage() {
  const { showToast } = useToast();
  const { pedidos, loading } = usePedidosAguardandoConfirmacao();
  const [motivosRecusa, setMotivosRecusa] = useState<string[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<null | "aprovar" | "recusar">(null);
  const [motivo, setMotivo] = useState("");
  const [motivoCustom, setMotivoCustom] = useState("");
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (dialogo) setDialogo(null);
      else if (selId) setSelId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogo, selId]);

  useEffect(() => {
    getDoc(doc(db, "configuracoes", "pagamento"))
      .then((snap) => {
        const data = snap.data();
        setMotivosRecusa(Array.isArray(data?.motivos_recusa) ? data.motivos_recusa : []);
      })
      .catch(() => setMotivosRecusa([]));
  }, []);

  const selecionado = selId ? pedidos.find((p) => p.id === selId) ?? null : null;

  function totalPedido(p: Pedido) {
    return p.itens.reduce((a, it) => a + it.preco * it.qtd, 0) + p.frete;
  }

  async function aprovar() {
    if (!selecionado) return;
    setProcessando(true);
    try {
      await updateDoc(doc(db, "pedidos", selecionado.id), {
        estado: "pago",
        historico: [
          ...selecionado.historico,
          { estado: "pago", quando: new Date().toISOString(), quem: "por você" },
        ],
      });
      showToast(`${selecionado.numero} aprovado`);
      setDialogo(null);
      setSelId(null);
    } catch {
      showToast("Não deu para aprovar. Tente de novo.");
    } finally {
      setProcessando(false);
    }
  }

  async function recusar() {
    if (!selecionado) return;
    const observacao = motivo === "Outro" ? motivoCustom.trim() : motivo;
    if (!observacao) {
      showToast("Escolha ou descreva o motivo da recusa");
      return;
    }
    setProcessando(true);
    try {
      await updateDoc(doc(db, "pedidos", selecionado.id), {
        estado: "aguardando_pagamento",
        comprovanteUrl: null,
        comprovanteEnviadoEm: null,
        valorComprovante: null,
        historico: [
          ...selecionado.historico,
          { estado: "aguardando_pagamento", quando: new Date().toISOString(), quem: "por você", observacao: `Comprovante recusado: ${observacao}` },
        ],
      });
      showToast(`${selecionado.numero} recusado`);
      setDialogo(null);
      setSelId(null);
      setMotivo("");
      setMotivoCustom("");
    } catch {
      showToast("Não deu para recusar. Tente de novo.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <main className="min-w-0 flex-1 p-10">
      <h1 className="m-0 text-[30px] font-semibold tracking-tight">Conferência</h1>
      <p className="mt-1.5 text-[15px] text-ink-soft">
        {pedidos.length > 0 ? (
          <>
            <span className="font-mono font-semibold text-ink">{pedidos.length}</span>{" "}
            {pedidos.length === 1 ? "comprovante esperando conferência" : "comprovantes esperando conferência"}
          </>
        ) : (
          "Nenhum comprovante esperando conferência agora."
        )}
      </p>

      {loading ? (
        <div className="mt-14 flex justify-center">
          <Spinner className="h-6 w-6 border-primary/25 border-t-primary" />
        </div>
      ) : pedidos.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-white">
          <div className="grid grid-cols-[100px_minmax(160px,1.6fr)_minmax(120px,1fr)_minmax(120px,1fr)_64px] items-center gap-3 border-b border-border bg-paper px-5 text-xs font-medium uppercase tracking-wider text-ink-soft" style={{ height: 44 }}>
            <div>Pedido</div>
            <div>Cliente</div>
            <div className="text-right">Total</div>
            <div className="text-right">Valor enviado</div>
            <div />
          </div>
          {pedidos.map((p) => {
            const divergente = typeof p.valorComprovante === "number" && Math.abs(p.valorComprovante - totalPedido(p)) > 0.01;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelId(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelId(p.id);
                  }
                }}
                className="grid min-h-15 cursor-pointer grid-cols-[100px_minmax(160px,1.6fr)_minmax(120px,1fr)_minmax(120px,1fr)_64px] items-center gap-3 border-b border-border px-5 transition-colors hover:bg-black/[0.02]"
              >
                <div className="font-mono text-sm">{p.numero}</div>
                <div className="text-sm font-medium">{p.cliente}</div>
                <div className="whitespace-nowrap text-right font-mono text-sm">{formatBRL(totalPedido(p))}</div>
                <div className={cn("whitespace-nowrap text-right font-mono text-sm", divergente && "font-semibold text-danger")}>
                  {typeof p.valorComprovante === "number" ? formatBRL(p.valorComprovante) : "—"}
                </div>
                <div className="flex justify-end">
                  {p.comprovanteUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.comprovanteUrl} alt="" className="h-10 w-10 rounded-md border border-border object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border text-ink-soft">
                      <ImageOff size={16} strokeWidth={1.6} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-border bg-white px-6 py-14 text-center">
          <div className="text-base font-semibold">Tudo conferido.</div>
          <div className="mt-1.5 text-sm text-ink-soft">Quando um cliente enviar comprovante, ele aparece aqui.</div>
        </div>
      )}

      <AnimatePresence>
        {selecionado && (
          <motion.div
            key="drawer-backdrop"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setSelId(null)}
            className="fixed inset-0 z-40 flex justify-end bg-[rgba(16,24,40,0.2)]"
          >
            <motion.div
              variants={drawerContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              className="flex h-full w-120 max-w-full flex-col bg-white shadow-[-8px_0_28px_rgba(16,24,40,0.14)]"
            >
              <ConferenciaDrawer
                key={selecionado.id}
                pedido={selecionado}
                total={totalPedido(selecionado)}
                onClose={() => setSelId(null)}
                onAprovar={() => setDialogo("aprovar")}
                onRecusar={() => {
                  setMotivo("");
                  setMotivoCustom("");
                  setDialogo("recusar");
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={dialogo === "aprovar"} onClose={() => setDialogo(null)} maxWidth={420}>
        <ModalTitle>{selecionado ? `Aprovar o pagamento de ${selecionado.numero}?` : ""}</ModalTitle>
        <ModalBody>O pedido avança para separação e o cliente é avisado que o pagamento foi confirmado.</ModalBody>
        <div className="mt-5.5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDialogo(null)}>
            Voltar
          </Button>
          <Button onClick={aprovar} loading={processando}>
            Aprovar
          </Button>
        </div>
      </Modal>

      <Modal open={dialogo === "recusar"} onClose={() => setDialogo(null)} maxWidth={440}>
        <ModalTitle>{selecionado ? `Recusar o comprovante de ${selecionado.numero}?` : ""}</ModalTitle>
        <ModalBody>O pedido volta para aguardando pagamento e o cliente é avisado do motivo.</ModalBody>
        <div className="mt-4 flex flex-col gap-1.5">
          {motivosRecusa.map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-tint">
              <input type="radio" name="motivo-recusa" checked={motivo === m} onChange={() => setMotivo(m)} className="h-4 w-4 accent-primary" />
              {m}
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-tint">
            <input type="radio" name="motivo-recusa" checked={motivo === "Outro"} onChange={() => setMotivo("Outro")} className="h-4 w-4 accent-primary" />
            Outro
          </label>
          {motivo === "Outro" && (
            <Textarea
              rows={2}
              value={motivoCustom}
              onChange={(e) => setMotivoCustom(e.target.value)}
              placeholder="Descreva o motivo"
              className="mt-1"
            />
          )}
        </div>
        <div className="mt-5.5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDialogo(null)}>
            Voltar
          </Button>
          <Button variant="danger" onClick={recusar} loading={processando}>
            Recusar
          </Button>
        </div>
      </Modal>
    </main>
  );
}

function ConferenciaDrawer({
  pedido,
  total,
  onClose,
  onAprovar,
  onRecusar,
}: {
  pedido: Pedido;
  total: number;
  onClose: () => void;
  onAprovar: () => void;
  onRecusar: () => void;
}) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comprovanteUrl, setComprovanteUrl] = useState(pedido.comprovanteUrl ?? null);
  const [salvandoUrl, setSalvandoUrl] = useState(false);
  const { upload, uploading } = useCloudinaryUpload({
    folder: "nova-era-tintas/comprovantes",
    onError: (message) => showToast(message),
  });

  async function trocarComprovante(file: File) {
    const result = await upload(file);
    if (!result) return;
    setSalvandoUrl(true);
    try {
      await updateDoc(doc(db, "pedidos", pedido.id), {
        comprovanteUrl: result.url,
        comprovanteEnviadoEm: serverTimestamp(),
      });
      setComprovanteUrl(result.url);
      showToast("Comprovante salvo");
    } catch {
      showToast("Não deu para salvar o comprovante. Tente de novo.");
    } finally {
      setSalvandoUrl(false);
    }
  }

  const salvando = uploading || salvandoUrl;

  return (
    <>
      <div className="border-b border-border p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="font-mono text-[22px]">{pedido.numero}</span>
            <div className="mt-1 text-sm font-medium">{pedido.cliente}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-7.5 w-7.5 cursor-pointer items-center justify-center border-0 bg-transparent text-ink-soft">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-7">
          <div>
            <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-soft">Comprovante</div>
            <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-paper">
              {comprovanteUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={comprovanteUrl} alt="Comprovante enviado pelo cliente" className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-ink-soft">
                  <ImageOff size={28} strokeWidth={1.6} />
                  <span className="text-sm">Nenhum comprovante enviado</span>
                </div>
              )}
              {salvando && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Loader2 size={22} className="animate-spin text-primary" />
                </div>
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
                if (file) trocarComprovante(file);
              }}
            />
            <Button variant="outline" className="mt-3 h-9.5 w-full" loading={salvando} onClick={() => fileInputRef.current?.click()}>
              <Upload size={15} strokeWidth={1.8} />
              {comprovanteUrl ? "Substituir comprovante" : "Enviar comprovante"}
            </Button>
            <p className="mt-2 text-xs text-ink-soft">Use se o cliente enviou por WhatsApp e você precisa anexar aqui.</p>
          </div>

          <div>
            <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-soft">Valores</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-soft">Total do pedido</span>
                <span className="font-mono">{formatBRL(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Valor no comprovante</span>
                <span className={cn("font-mono", typeof pedido.valorComprovante === "number" && Math.abs(pedido.valorComprovante - total) > 0.01 && "font-semibold text-danger")}>
                  {typeof pedido.valorComprovante === "number" ? formatBRL(pedido.valorComprovante) : "—"}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-soft">Itens</div>
            <div className="flex flex-col gap-2.5">
              {pedido.itens.map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{it.nome}</div>
                    <div className="mt-0.5 text-xs text-ink-soft">{it.variacao}</div>
                  </div>
                  <div className="flex items-baseline gap-3 font-mono text-sm">
                    <span className="text-ink-soft">{it.qtd}×</span>
                    <span>{formatBRL(it.preco)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border p-6">
        <Button onClick={onAprovar} disabled={!comprovanteUrl}>
          Aprovar pagamento
        </Button>
        <button type="button" onClick={onRecusar} className="cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-medium text-danger">
          Recusar comprovante
        </button>
      </div>
    </>
  );
}
