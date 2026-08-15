"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, ChevronUp, ChevronDown, X, MessageCircle, Loader2 } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal, ModalTitle, ModalBody } from "@/components/ui/Modal";
import { StatusDot } from "@/components/ui/StatusDot";
import { useToast } from "@/components/ui/Toast";
import { drawerContent, staggerContainer, staggerItem } from "@/lib/animations";
import { formatBRL, cn } from "@/lib/utils";
import { usePedidos } from "@/lib/hooks/usePedidos";
import { useProdutos } from "@/lib/hooks/useProdutos";
import type { Pedido, PedidoEstado, PedidoItem, Produto } from "@/lib/types";

function itensIguais(a: PedidoItem[], b: PedidoItem[]) {
  if (a.length !== b.length) return false;
  return a.every((it, i) => it.produtoId === b[i].produtoId && it.variacao === b[i].variacao && it.qtd === b[i].qtd && it.preco === b[i].preco);
}

const ETAPAS: { id: PedidoEstado; rotulo: string; cor: string; suaVez: boolean }[] = [
  { id: "em_negociacao", rotulo: "Negociação", cor: "#B54708", suaVez: true },
  { id: "aguardando_pagamento", rotulo: "Aguard. pgto", cor: "#B54708", suaVez: false },
  { id: "aguardando_confirmacao", rotulo: "Conferir", cor: "#B54708", suaVez: true },
  { id: "pago", rotulo: "Pago", cor: "#12B76A", suaVez: true },
  { id: "separacao", rotulo: "Separação", cor: "#12B76A", suaVez: true },
  { id: "enviado", rotulo: "Enviado", cor: "#12B76A", suaVez: false },
];

const ESTADO_INFO: Record<string, { rotulo: string; cor: string }> = {
  em_negociacao: { rotulo: "Em negociação", cor: "#B54708" },
  aguardando_pagamento: { rotulo: "Aguardando pagamento", cor: "#B54708" },
  aguardando_confirmacao: { rotulo: "Aguardando confirmação", cor: "#B54708" },
  pago: { rotulo: "Pago", cor: "#12B76A" },
  separacao: { rotulo: "Em separação", cor: "#12B76A" },
  enviado: { rotulo: "Enviado", cor: "#12B76A" },
  entregue: { rotulo: "Entregue", cor: "#667085" },
  expirado: { rotulo: "Expirado", cor: "#667085" },
  cancelado: { rotulo: "Cancelado", cor: "#667085" },
};

function fmtRelativo(iso: string) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  const diffMs = Date.now() - data.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 1) return "agora há pouco";
  if (diffH < 24) return `há ${diffH} ${diffH === 1 ? "hora" : "horas"}`;
  const diffD = Math.floor(diffH / 24);
  return `há ${diffD} ${diffD === 1 ? "dia" : "dias"}`;
}

function fmtDataHora(iso: string) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PedidosPage() {
  const { showToast } = useToast();
  const { pedidos, loading } = usePedidos();
  const [filtro, setFiltro] = useState<PedidoEstado | null>(null);
  const [busca, setBusca] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<null | "fechar" | "cancelar" | "avancar" | "expirados">(null);
  const [obsAvancar, setObsAvancar] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [itensEditados, setItensEditados] = useState<PedidoItem[] | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [adicionarItemAberto, setAdicionarItemAberto] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (dialogo) setDialogo(null);
      else if (selId !== null) setSelId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogo, selId]);

  const [selIdCarregado, setSelIdCarregado] = useState<string | null>(null);
  if (selId !== selIdCarregado) {
    setSelIdCarregado(selId);
    const pedido = selId ? pedidos.find((p) => p.id === selId) : undefined;
    setItensEditados(pedido ? pedido.itens.map((it) => ({ ...it })) : null);
  }

  const ativos = pedidos.filter((p) => p.estado !== "expirado");
  const expirados = pedidos.filter((p) => p.estado === "expirado");

  const contagens = Object.fromEntries(ETAPAS.map((e) => [e.id, ativos.filter((p) => p.estado === e.id).length]));
  const entregueCount = ativos.filter((p) => p.estado === "entregue").length;
  const suaVezTotal = ativos.filter((p) => ETAPAS.find((e) => e.id === p.estado)?.suaVez || p.estado === "entregue").length;

  const q = busca.trim().toLowerCase();
  const linhas = ativos.filter((p) => {
    if (filtro && p.estado !== filtro) return false;
    if (!q) return true;
    return p.numero.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q);
  });

  const selIndex = linhas.findIndex((p) => p.id === selId);
  const selecionado = selId ? pedidos.find((p) => p.id === selId) ?? null : null;

  function fmtTotal(p: Pedido) {
    return p.itens.reduce((a, it) => a + it.preco * it.qtd, 0) + p.frete;
  }

  async function avancarPara(id: string, novoEstado: PedidoEstado, observacao: string) {
    const pedido = pedidos.find((p) => p.id === id);
    if (!pedido) return;
    setProcessando(true);
    try {
      await updateDoc(doc(db, "pedidos", id), {
        estado: novoEstado,
        historico: [
          ...pedido.historico,
          { estado: novoEstado, quando: new Date().toISOString(), quem: "por você", observacao: observacao || undefined },
        ],
      });
    } catch {
      showToast("Não deu para atualizar o pedido. Tente de novo.");
    } finally {
      setProcessando(false);
    }
  }

  async function salvarEdicaoItens(id: string, novosItens: PedidoItem[]) {
    const pedido = pedidos.find((p) => p.id === id);
    if (!pedido) return;
    setSalvandoEdicao(true);
    try {
      await updateDoc(doc(db, "pedidos", id), {
        itens: novosItens,
        historico: [
          ...pedido.historico,
          {
            tipo: "edicao",
            estado: pedido.estado,
            quando: new Date().toISOString(),
            quem: "por você",
            observacao: "Itens do pedido revisados",
            itensAnteriores: pedido.itens,
          },
        ],
      });
      showToast("Pedido atualizado");
    } catch {
      showToast("Não deu para salvar as alterações. Tente de novo.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  const proximoEstado: Partial<Record<PedidoEstado, PedidoEstado>> = {
    pago: "separacao",
    separacao: "enviado",
    enviado: "entregue",
  };

  return (
    <main className="min-w-0 flex-1 p-10">
      <h1 className="m-0 text-[30px] font-semibold tracking-tight">Pedidos</h1>
      <p className="mt-1.5 flex items-baseline gap-1.5 text-[15px] text-ink-soft">
        {suaVezTotal > 0 ? (
          <>
            <span className="font-mono font-semibold text-ink">{suaVezTotal}</span>
            <span>esperando por você</span>
          </>
        ) : (
          <span>Nada esperando por você agora.</span>
        )}
      </p>

      <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-white px-6 py-5">
        <div className="flex min-w-180 items-stretch gap-1.5">
          {ETAPAS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setFiltro((f) => (f === e.id ? null : e.id))}
              className={cn(
                "flex min-w-23 flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-lg border-0 px-1.5 py-2.5 font-sans transition-colors hover:bg-paper"
              )}
              style={{ background: filtro === e.id ? "#F7F6F2" : "transparent" }}
            >
              <StatusDot color={e.cor} />
              <span className="font-mono text-[22px]">{contagens[e.id] ?? 0}</span>
              <span className="text-center text-xs" style={{ fontWeight: filtro === e.id ? 600 : 400, color: filtro === e.id ? "#101828" : "#667085" }}>
                {e.rotulo}
              </span>
            </button>
          ))}
          <span className="mx-4 w-px shrink-0 bg-border" />
          <button
            type="button"
            onClick={() => setFiltro((f) => (f === "entregue" ? null : "entregue"))}
            className="flex min-w-23 shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-border bg-paper px-3 py-3 font-sans"
          >
            <StatusDot color="#667085" />
            <span className="font-mono text-[22px]">{entregueCount}</span>
            <span className="text-center text-xs" style={{ fontWeight: filtro === "entregue" ? 600 : 400, color: filtro === "entregue" ? "#101828" : "#667085" }}>
              Entregue
            </span>
          </button>
          <div className="flex items-end pl-4">
            <span className="flex items-center gap-2 whitespace-nowrap text-[11px] text-ink-soft">
              <StatusDot color="#667085" /> sua vez
              <StatusDot color="#667085" filled={false} />
              esperando
            </span>
          </div>
        </div>
      </div>

      {expirados.length > 0 && (
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={() => setDialogo("expirados")} className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] text-danger">
            {expirados.length} pedidos expirados
          </button>
        </div>
      )}

      <div className="relative mt-4 flex w-90 max-w-full">
        <Input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente ou número do pedido"
          className="h-10.5"
        />
      </div>

      {loading ? (
        <div className="mt-14 flex justify-center">
          <Loader2 size={22} className="animate-spin text-primary" />
        </div>
      ) : linhas.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-white">
          <div className="grid grid-cols-[100px_minmax(160px,1.6fr)_minmax(170px,1.4fr)_70px_minmax(120px,1fr)_minmax(120px,1fr)] items-center gap-3 border-b border-border bg-paper px-5 text-xs font-medium uppercase tracking-wider text-ink-soft" style={{ height: 44 }}>
            <div>Pedido</div>
            <div>Cliente</div>
            <div>Estado</div>
            <div>Itens</div>
            <div className="text-right">Total</div>
            <div>Quando</div>
          </div>
          {linhas.map((p) => {
            const info = ESTADO_INFO[p.estado];
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
                className="grid min-h-14 cursor-pointer grid-cols-[100px_minmax(160px,1.6fr)_minmax(170px,1.4fr)_70px_minmax(120px,1fr)_minmax(120px,1fr)] items-center gap-3 border-b border-border px-5 transition-colors hover:bg-black/[0.02]"
              >
                <div className="font-mono text-sm">{p.numero}</div>
                <div className="text-sm font-medium">{p.cliente}</div>
                <div className="flex items-center gap-2 text-sm text-ink-soft">
                  <StatusDot color={info.cor} />
                  {info.rotulo}
                </div>
                <div className="font-mono text-sm text-ink-soft">{p.itens.reduce((a, it) => a + it.qtd, 0)}</div>
                <div className="whitespace-nowrap text-right font-mono text-sm">{formatBRL(fmtTotal(p))}</div>
                <div className="flex items-center gap-1.5 text-[13px] text-ink-soft">
                  <StatusDot color={info.cor} />
                  {fmtRelativo(p.criadoEm)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-border bg-white px-6 py-14 text-center">
          <div className="text-base font-semibold">Nenhum pedido nessa etapa.</div>
          <div className="mt-1.5 text-sm text-ink-soft">Quando um pedido chegar aqui, ele aparece nesta lista.</div>
        </div>
      )}

      <AnimatePresence>
        {selecionado && (
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
              <PedidoDrawerHeader
                pedido={selecionado}
                index={selIndex}
                total={linhas.length}
                onPrev={() => selIndex > 0 && setSelId(linhas[selIndex - 1].id)}
                onNext={() => selIndex < linhas.length - 1 && setSelId(linhas[selIndex + 1].id)}
                onClose={() => setSelId(null)}
                onCopy={() => {
                  navigator.clipboard?.writeText(selecionado.numero);
                  showToast("Número copiado");
                }}
              />
              <PedidoDrawerBody
                pedido={selecionado}
                total={
                  itensEditados
                    ? itensEditados.reduce((a, it) => a + it.preco * it.qtd, 0) + selecionado.frete
                    : fmtTotal(selecionado)
                }
                itensEditados={itensEditados}
                onMudarQtd={(i, delta) => {
                  setItensEditados((atual) => {
                    if (!atual) return atual;
                    const proximo = atual
                      .map((it, idx) => (idx === i ? { ...it, qtd: it.qtd + delta } : it))
                      .filter((it) => it.qtd > 0);
                    return proximo;
                  });
                }}
                onAdicionarItem={() => setAdicionarItemAberto(true)}
              />
              <div className="flex flex-col gap-3 border-t border-border p-6">
                {selecionado.estado === "em_negociacao" &&
                  itensEditados &&
                  !itensIguais(itensEditados, selecionado.itens) && (
                    <div className="flex flex-col gap-2">
                      {itensEditados.length === 0 && (
                        <div className="text-center text-[13px] text-danger">
                          O pedido precisa ter pelo menos 1 item para salvar.
                        </div>
                      )}
                      <div className="flex gap-2.5">
                        <Button
                          variant="secondary"
                          className="flex-1"
                          onClick={() => setItensEditados(selecionado.itens.map((it) => ({ ...it })))}
                        >
                          Descartar
                        </Button>
                        <Button
                          className="flex-1"
                          loading={salvandoEdicao}
                          disabled={itensEditados.length === 0}
                          onClick={() => salvarEdicaoItens(selecionado.id, itensEditados)}
                        >
                          Salvar alterações
                        </Button>
                      </div>
                    </div>
                  )}
                {selecionado.estado === "em_negociacao" && (
                  <Button onClick={() => setDialogo("fechar")}>Fechar pedido</Button>
                )}
                {selecionado.estado === "aguardando_pagamento" && (
                  <div className="text-center text-sm text-ink-soft">Aguardando o cliente enviar o comprovante.</div>
                )}
                {selecionado.estado === "aguardando_confirmacao" && (
                  <div className="text-center text-sm text-ink-soft">Comprovante enviado — confira na Conferência.</div>
                )}
                {proximoEstado[selecionado.estado] && (
                  <Button
                    onClick={() => {
                      setObsAvancar("");
                      setDialogo("avancar");
                    }}
                  >
                    Avançar para {ESTADO_INFO[proximoEstado[selecionado.estado]!].rotulo}
                  </Button>
                )}
                <div className="flex justify-center gap-5">
                  <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-medium text-ink-soft">
                    Falar no WhatsApp
                  </button>
                  {selecionado.estado === "em_negociacao" && (
                    <button
                      type="button"
                      onClick={() => setDialogo("cancelar")}
                      className="cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-medium text-danger"
                    >
                      Cancelar pedido
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={dialogo === "fechar"} onClose={() => setDialogo(null)} maxWidth={460}>
        <ModalTitle>{selecionado ? `Fechar o pedido ${selecionado.numero}?` : ""}</ModalTitle>
        <ModalBody>
          Os itens travam e o cliente vai poder pagar. Você ainda consegue conversar pelo WhatsApp se precisar ajustar.
        </ModalBody>
        {selecionado && (
          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="text-sm text-ink-soft">{selecionado.itens.reduce((a, it) => a + it.qtd, 0)} itens</span>
            <span className="font-mono text-xl">{formatBRL(fmtTotal(selecionado))}</span>
          </div>
        )}
        <div className="mt-4.5 flex items-center gap-3 rounded-lg border border-border bg-paper p-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Link do pedido</div>
            <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[13px]">
              novaeratintas.com/p/{selecionado?.numero.replace("#", "")}
            </div>
          </div>
          <Button
            variant="outline"
            className="h-8.5 shrink-0 text-[13px]"
            onClick={() => {
              navigator.clipboard?.writeText(`novaeratintas.com/p/${selecionado?.numero.replace("#", "")}`);
              setLinkCopiado(true);
              setTimeout(() => setLinkCopiado(false), 1600);
            }}
          >
            {linkCopiado ? "Copiado!" : "Copiar"}
          </Button>
        </div>
        <div className="mt-5.5 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDialogo(null)}>
            Voltar
          </Button>
          <Button
            loading={processando}
            onClick={async () => {
              if (selecionado) await avancarPara(selecionado.id, "aguardando_pagamento", "");
              setDialogo(null);
              showToast("Pedido fechado — abrindo WhatsApp");
            }}
          >
            Fechar e abrir WhatsApp
          </Button>
        </div>
      </Modal>

      <Modal open={dialogo === "cancelar"} onClose={() => setDialogo(null)} maxWidth={420}>
        <ModalTitle>{selecionado ? `Cancelar o pedido ${selecionado.numero}?` : ""}</ModalTitle>
        <ModalBody>O cliente perde o link de pagamento. O estoque não muda — ele nunca chegou a baixar.</ModalBody>
        <div className="mt-5.5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDialogo(null)}>
            Voltar
          </Button>
          <Button
            variant="danger"
            loading={processando}
            onClick={async () => {
              if (selecionado) await avancarPara(selecionado.id, "cancelado", "");
              setDialogo(null);
              setSelId(null);
              showToast("Pedido cancelado");
            }}
          >
            Cancelar pedido
          </Button>
        </div>
      </Modal>

      <Modal open={dialogo === "avancar"} onClose={() => setDialogo(null)} maxWidth={440}>
        <ModalTitle>
          {selecionado && proximoEstado[selecionado.estado]
            ? `Avançar ${selecionado.numero} para ${ESTADO_INFO[proximoEstado[selecionado.estado]!].rotulo}?`
            : ""}
        </ModalTitle>
        <ModalBody>Fica registrado no histórico do pedido com a data e a hora.</ModalBody>
        <label htmlFor="pd-obs" className="mt-4 block text-[13px] font-medium">
          Observação (opcional)
        </label>
        <Textarea
          id="pd-obs"
          rows={3}
          value={obsAvancar}
          onChange={(e) => setObsAvancar(e.target.value)}
          placeholder="Ex.: Entreguei na portaria, recebido por Dona Neusa."
          className="mt-1.5"
        />
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDialogo(null)}>
            Voltar
          </Button>
          <Button
            loading={processando}
            onClick={async () => {
              if (selecionado && proximoEstado[selecionado.estado]) {
                await avancarPara(selecionado.id, proximoEstado[selecionado.estado]!, obsAvancar);
                showToast("Status atualizado");
              }
              setDialogo(null);
            }}
          >
            Confirmar
          </Button>
        </div>
      </Modal>

      <Modal open={dialogo === "expirados"} onClose={() => setDialogo(null)} maxWidth={480}>
        <ModalTitle>Pedidos expirados</ModalTitle>
        <ModalBody>
          Ficaram sem pagamento além do prazo e saíram da lista ativa. Reabrir devolve o link pro cliente.
        </ModalBody>
        <div className="mt-4 border-t border-border">
          {expirados.map((x) => (
            <div key={x.id} className="flex items-center gap-3 border-b border-border py-3">
              <span className="font-mono text-sm">{x.numero}</span>
              <span className="flex-1 text-sm font-medium">{x.cliente}</span>
              <span className="font-mono text-sm text-ink-soft">{formatBRL(fmtTotal(x))}</span>
              <button
                type="button"
                onClick={async () => {
                  await avancarPara(x.id, "aguardando_pagamento", "Pedido reaberto");
                  showToast(`${x.numero} reaberto`);
                }}
                className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-primary"
              >
                Reabrir pedido
              </button>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={() => setDialogo(null)}>
            Fechar
          </Button>
        </div>
      </Modal>

      <AdicionarItemModal
        open={adicionarItemAberto}
        onClose={() => setAdicionarItemAberto(false)}
        onAdicionar={(item) => {
          setItensEditados((atual) => {
            const base = atual ?? [];
            const idx = base.findIndex((it) => it.produtoId === item.produtoId && it.variacao === item.variacao);
            if (idx >= 0) {
              return base.map((it, i) => (i === idx ? { ...it, qtd: it.qtd + 1 } : it));
            }
            return [...base, item];
          });
          setAdicionarItemAberto(false);
        }}
      />
    </main>
  );
}

function PedidoDrawerHeader({
  pedido,
  index,
  total,
  onPrev,
  onNext,
  onClose,
  onCopy,
}: {
  pedido: Pedido;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onCopy: () => void;
}) {
  const info = ESTADO_INFO[pedido.estado];
  return (
    <div className="border-b border-border p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="group flex items-center gap-3">
          <span className="font-mono text-[22px]">{pedido.numero}</span>
          <button type="button" onClick={onCopy} aria-label="Copiar número do pedido" className="flex cursor-pointer border-0 bg-transparent p-0 text-ink-soft opacity-0 transition-opacity group-hover:opacity-100">
            <Copy size={15} strokeWidth={1.8} />
          </button>
          <span className="flex items-center gap-2 text-sm font-medium">
            <StatusDot color={info.cor} />
            {info.rotulo}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onPrev} disabled={index <= 0} aria-label="Pedido anterior" className={cn("flex h-7.5 w-7.5 items-center justify-center rounded-md border border-border bg-white text-ink-soft", index <= 0 ? "cursor-not-allowed opacity-40" : "cursor-pointer")}>
            <ChevronUp size={15} strokeWidth={2} />
          </button>
          <button type="button" onClick={onNext} disabled={index >= total - 1} aria-label="Próximo pedido" className={cn("flex h-7.5 w-7.5 items-center justify-center rounded-md border border-border bg-white text-ink-soft", index >= total - 1 ? "cursor-not-allowed opacity-40" : "cursor-pointer")}>
            <ChevronDown size={15} strokeWidth={2} />
          </button>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-7.5 w-7.5 cursor-pointer items-center justify-center border-0 bg-transparent text-lg leading-none text-ink-soft">
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="mt-2 text-[13px] text-ink-soft">Criado em {fmtDataHora(pedido.criadoEm)}</div>
    </div>
  );
}

function PedidoDrawerBody({
  pedido,
  total,
  itensEditados,
  onMudarQtd,
  onAdicionarItem,
}: {
  pedido: Pedido;
  total: number;
  itensEditados: PedidoItem[] | null;
  onMudarQtd: (index: number, delta: number) => void;
  onAdicionarItem: () => void;
}) {
  const editavel = pedido.estado === "em_negociacao";
  const itens = editavel && itensEditados ? itensEditados : pedido.itens;
  const subtotal = itens.reduce((a, it) => a + it.preco * it.qtd, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-col gap-7">
        <div>
          <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-soft">Cliente</div>
          <a href="#" className="text-[15px] font-medium text-ink no-underline">{pedido.cliente}</a>
          <a href="#" className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft no-underline">
            <span className="font-mono">{pedido.telefone}</span>
            <MessageCircle size={15} strokeWidth={1.8} />
          </a>
        </div>

        <div>
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-soft">Itens</div>
          <motion.div variants={staggerContainer(0.05)} initial="hidden" animate="visible" className="flex flex-col gap-3">
            {itens.map((it, i) => (
              <motion.div key={`${it.produtoId}-${it.variacao}`} variants={staggerItem} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{it.nome}</div>
                  <div className="mt-0.5 text-[13px] text-ink-soft">{it.variacao}</div>
                </div>
                {editavel ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center overflow-hidden rounded-lg border border-border">
                      <button type="button" onClick={() => onMudarQtd(i, -1)} className="h-8 w-7.5 cursor-pointer border-0 bg-white text-ink-soft">−</button>
                      <span className="min-w-6.5 text-center font-mono text-sm">{it.qtd}</span>
                      <button type="button" onClick={() => onMudarQtd(i, 1)} className="h-8 w-7.5 cursor-pointer border-0 bg-white text-ink-soft">+</button>
                    </div>
                    <span className="w-21 text-right font-mono text-[13px]">{formatBRL(it.preco)}</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-3 font-mono text-sm">
                    <span className="text-ink-soft">{it.qtd}×</span>
                    <span>{formatBRL(it.preco)}</span>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
          {editavel && (
            <button type="button" onClick={onAdicionarItem} className="mt-3.5 cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-medium text-primary">
              + Adicionar item
            </button>
          )}
          <div className="mt-4.5 flex flex-col gap-2 border-t border-border pt-3.5">
            <div className="flex justify-between text-sm text-ink-soft">
              <span>Subtotal</span>
              <span className="font-mono">{formatBRL(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-ink-soft">
              <span>Frete</span>
              <span className="font-mono">{formatBRL(pedido.frete)}</span>
            </div>
            <div className="flex items-baseline justify-between text-sm font-semibold">
              <span>Total</span>
              <span className="font-mono text-lg">{formatBRL(total)}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-soft">Endereço — do cadastro atual</div>
          <div className="text-sm text-pretty">{pedido.endereco}</div>
          {pedido.enderecoMudou && (
            <div className="mt-3 flex gap-2.5 rounded-lg border border-status-amber/40 bg-status-amber-bg p-3">
              <span className="text-[13px] text-status-amber text-pretty">
                O cliente mudou o endereço depois desse pedido. O endereço acima é o que valia quando ele foi feito.
              </span>
            </div>
          )}
        </div>

        <div>
          <div className="mb-3.5 text-[11px] font-medium uppercase tracking-wider text-ink-soft">Histórico</div>
          <div className="relative pl-5.5">
            <span className="absolute bottom-1 left-1.5 top-1 w-px bg-border" />
            <div className="flex flex-col gap-4.5">
              {pedido.historico.map((h, i) => {
                const ehEdicao = h.tipo === "edicao";
                const info = ehEdicao ? { rotulo: "Itens revisados", cor: "#7A5AF8" } : ESTADO_INFO[h.estado] ?? { rotulo: h.estado, cor: "#667085" };
                const atual = i === pedido.historico.length - 1;
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative">
                    <span
                      className={cn("absolute -left-5.5 top-0.5 rounded-full border-2", atual && "animate-pulse")}
                      style={{ width: 10, height: 10, background: info.cor, borderColor: info.cor }}
                    />
                    <div className="text-sm" style={{ fontWeight: atual ? 600 : 400 }}>{info.rotulo}</div>
                    <div className="mt-0.5 text-xs text-ink-soft">{fmtDataHora(h.quando)} · {h.quem}</div>
                    {h.observacao && <div className="mt-1 text-[13px] italic text-ink-soft">{h.observacao}</div>}
                    {ehEdicao && h.itensAnteriores && (
                      <div className="mt-1.5 flex flex-col gap-0.5 text-[12px] text-ink-soft">
                        {h.itensAnteriores.map((it) => (
                          <div key={`${it.produtoId}-${it.variacao}`} className="font-mono">
                            {it.nome} ({it.variacao}): {it.qtd}× era {formatBRL(it.preco)}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdicionarItemModal({
  open,
  onClose,
  onAdicionar,
}: {
  open: boolean;
  onClose: () => void;
  onAdicionar: (item: PedidoItem) => void;
}) {
  const { produtos, loading } = useProdutos();
  const [busca, setBusca] = useState("");
  const [produtoSel, setProdutoSel] = useState<Produto | null>(null);
  const [openCarregado, setOpenCarregado] = useState(open);
  if (open !== openCarregado) {
    setOpenCarregado(open);
    if (!open) {
      setBusca("");
      setProdutoSel(null);
    }
  }

  const q = busca.trim().toLowerCase();
  const encontrados = q ? produtos.filter((p) => p.ativo && p.nome.toLowerCase().includes(q)) : produtos.filter((p) => p.ativo);

  return (
    <Modal open={open} onClose={onClose} maxWidth={440}>
      <ModalTitle>Adicionar item ao pedido</ModalTitle>
      {!produtoSel ? (
        <>
          <Input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto"
            className="mt-4"
          />
          <div className="mt-3 max-h-80 overflow-y-auto">
            {loading && <div className="py-4 text-center text-sm text-ink-soft">Carregando produtos...</div>}
            {!loading && encontrados.length === 0 && (
              <div className="py-4 text-center text-sm text-ink-soft">Nenhum produto encontrado.</div>
            )}
            {encontrados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProdutoSel(p)}
                className="flex w-full cursor-pointer items-center justify-between border-0 border-b border-border bg-transparent px-1 py-3 text-left font-sans"
              >
                <span className="text-sm font-medium">{p.nome}</span>
                <span className="text-xs text-ink-soft">{Object.keys(p.variacoes).length} variações</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setProdutoSel(null)}
            className="mt-4 cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-primary"
          >
            ← Escolher outro produto
          </button>
          <div className="mt-3 text-sm font-medium">{produtoSel.nome}</div>
          <div className="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
            {Object.entries(produtoSel.variacoes)
              .filter(([, v]) => v.ativo && v.estoque > 0)
              .map(([chave, v]) => (
                <button
                  key={chave}
                  type="button"
                  onClick={() =>
                    onAdicionar({
                      produtoId: produtoSel.id,
                      nome: produtoSel.nome,
                      variacao: `${v.cor} · ${v.volume}`,
                      qtd: 1,
                      preco: v.preco,
                    })
                  }
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-transparent px-3.5 py-2.5 text-left font-sans hover:border-primary"
                >
                  <span className="text-sm">{v.cor} · {v.volume}</span>
                  <span className="font-mono text-[13px]">{formatBRL(v.preco)}</span>
                </button>
              ))}
            {Object.values(produtoSel.variacoes).filter((v) => v.ativo && v.estoque > 0).length === 0 && (
              <div className="py-3 text-center text-sm text-ink-soft">Sem variações disponíveis em estoque.</div>
            )}
          </div>
        </>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Modal>
  );
}
