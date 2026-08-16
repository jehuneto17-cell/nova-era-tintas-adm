"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, ChevronDown, X, MessageCircle, Lock, Loader2 } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/StatusDot";
import { useToast } from "@/components/ui/Toast";
import { drawerContent, staggerContainer, staggerItem } from "@/lib/animations";
import { formatBRL, cn, whatsappLink } from "@/lib/utils";
import { useClientes } from "@/lib/hooks/useClientes";
import { usePedidos } from "@/lib/hooks/usePedidos";
import type { Cliente, EnderecoCliente, Pedido } from "@/lib/types";

const ESTADO_INFO: Record<string, { rotulo: string; cor: string }> = {
  em_negociacao: { rotulo: "Em negociação", cor: "#B54708" },
  aguardando_pagamento: { rotulo: "Aguardando pagamento", cor: "#B54708" },
  aguardando_confirmacao: { rotulo: "Aguardando confirmação", cor: "#B54708" },
  pago: { rotulo: "Pago", cor: "#12B76A" },
  separacao: { rotulo: "Em separação", cor: "#12B76A" },
  enviado: { rotulo: "Enviado", cor: "#12B76A" },
  entregue: { rotulo: "Entregue", cor: "#667085" },
};
const FROZEN_STATES = new Set(["pago", "separacao", "enviado", "entregue"]);

type Ordem = "pedidos" | "gastou" | "ultimo";

interface ItemLevado {
  nome: string;
  variacao: string;
  vezes: number;
  ultima: string;
}

function fmtDataBr(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}
function diasDesde(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 99999;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
}
function humano(dias: number) {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  if (dias < 60) return "há 1 mês";
  return `há ${Math.round(dias / 30)} meses`;
}

interface EnderecoForm {
  rotulo: string;
  cep: string;
  uf: string;
  cidade: string;
  bairro: string;
  rua: string;
  numero: string;
  complemento: string;
}

const ENDERECO_VAZIO: EnderecoForm = { rotulo: "", cep: "", uf: "", cidade: "", bairro: "", rua: "", numero: "", complemento: "" };

function enderecoParaTexto(e: EnderecoForm) {
  const linha1 = [e.rua.trim(), e.numero.trim()].filter(Boolean).join(", ");
  const parte1 = [linha1, e.complemento.trim()].filter(Boolean).join(" - ");
  const parte2 = [e.bairro.trim(), [e.cidade.trim(), e.uf.trim()].filter(Boolean).join("/")].filter(Boolean).join(", ");
  const cep = e.cep.trim() ? `CEP ${e.cep.trim()}` : "";
  return [parte1, parte2, cep].filter(Boolean).join(" - ");
}

function enderecoDeCliente(e: EnderecoCliente): EnderecoForm {
  return {
    rotulo: e.rotulo,
    cep: e.cep ?? "",
    uf: e.uf ?? "",
    cidade: e.cidade ?? "",
    bairro: e.bairro ?? "",
    rua: e.rua ?? "",
    numero: e.numero ?? "",
    complemento: e.complemento ?? "",
  };
}

function pedidosDoCliente(pedidos: Pedido[], clienteId: string) {
  return pedidos
    .filter((p) => p.clienteId === clienteId)
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
}

function itensLevados(pedidosCliente: Pedido[]): ItemLevado[] {
  const mapa = new Map<string, ItemLevado>();
  for (const p of pedidosCliente) {
    for (const it of p.itens) {
      const key = `${it.nome}|${it.variacao}`;
      const existente = mapa.get(key);
      if (existente) {
        existente.vezes += it.qtd;
        if (new Date(p.criadoEm) > new Date(existente.ultima)) existente.ultima = p.criadoEm;
      } else {
        mapa.set(key, { nome: it.nome, variacao: it.variacao, vezes: it.qtd, ultima: p.criadoEm });
      }
    }
  }
  return Array.from(mapa.values()).sort((a, b) => new Date(b.ultima).getTime() - new Date(a.ultima).getTime());
}

export default function ClientesPage() {
  const { showToast } = useToast();
  const { clientes, loading } = useClientes();
  const { pedidos: todosPedidos } = usePedidos();
  const [busca, setBusca] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<Ordem>("ultimo");
  const [desc, setDesc] = useState(true);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<{ nome: string; telefone: string; email: string } | null>(null);
  const [salvandoContato, setSalvandoContato] = useState(false);
  const [addEnd, setAddEnd] = useState(false);
  const [novoEnd, setNovoEnd] = useState<EnderecoForm>(ENDERECO_VAZIO);
  const [editEndId, setEditEndId] = useState<string | null>(null);
  const [editEndForm, setEditEndForm] = useState<EnderecoForm>(ENDERECO_VAZIO);
  const [salvandoEnd, setSalvandoEnd] = useState(false);
  const [verLevou, setVerLevou] = useState(false);
  const [verPedidos, setVerPedidos] = useState(false);
  const [verHistorico, setVerHistorico] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (addEnd) setAddEnd(false);
      else if (editEndId !== null) setEditEndId(null);
      else if (selId !== null) {
        setSelId(null);
        setEditando(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addEnd, editEndId, selId]);

  const q = busca.trim().toLowerCase();
  const qd = q.replace(/\D/g, "");
  const linhas = clientes
    .filter((c) => {
      if (!q) return true;
      if (c.nome.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) return true;
      return qd.length > 0 && c.telefone.replace(/\D/g, "").includes(qd);
    })
    .map((c) => {
      const pedidosC = pedidosDoCliente(todosPedidos, c.id);
      const gastou = pedidosC.reduce((a, p) => a + p.itens.reduce((s, it) => s + it.preco * it.qtd, 0) + p.frete, 0);
      const ultimo = pedidosC[0];
      const diasUlt = ultimo ? diasDesde(ultimo.criadoEm) : 99999;
      const emAberto = ultimo ? ultimo.estado !== "entregue" : false;
      return {
        c,
        pedidosC,
        gastou,
        diasUlt,
        ultimoTexto: ultimo ? humano(diasUlt) : "nunca",
        emAberto,
        estadoCor: ultimo ? ESTADO_INFO[ultimo.estado]?.cor ?? "#667085" : "#667085",
      };
    });

  const sinal = desc ? -1 : 1;
  linhas.sort((a, b) => {
    if (ordem === "pedidos") return sinal * (a.pedidosC.length - b.pedidosC.length);
    if (ordem === "gastou") return sinal * (a.gastou - b.gastou);
    return sinal * (b.diasUlt - a.diasUlt);
  });

  const selecionado = selId !== null ? clientes.find((c) => c.id === selId) ?? null : null;
  const selIndex = linhas.findIndex((l) => l.c.id === selId);
  const pedidosSelecionado = selecionado ? pedidosDoCliente(todosPedidos, selecionado.id) : [];
  const levouSelecionado = itensLevados(pedidosSelecionado);
  const gastouSelecionado = pedidosSelecionado.reduce((a, p) => a + p.itens.reduce((s, it) => s + it.preco * it.qtd, 0) + p.frete, 0);

  function ordenarPor(campo: Ordem) {
    if (ordem === campo) setDesc((d) => !d);
    else {
      setOrdem(campo);
      setDesc(true);
    }
  }

  function selecionar(id: string) {
    setSelId(id);
    setEditando(false);
    setAddEnd(false);
    setEditEndId(null);
    setVerLevou(false);
    setVerPedidos(false);
    setVerHistorico(false);
  }

  async function atualizarCliente(id: string, patch: Partial<Cliente>) {
    try {
      await updateDoc(doc(db, "clientes", id), patch);
    } catch {
      showToast("Não deu para salvar. Tente de novo.");
    }
  }

  return (
    <main className="min-w-0 flex-1 p-10">
      <h1 className="m-0 text-[30px] font-semibold tracking-tight">Clientes</h1>
      <p className="mt-1.5 flex items-baseline gap-1.5 text-[15px] text-ink-soft">
        <span className="font-mono font-semibold text-ink">{clientes.length}</span>
        <span>pessoas já compraram na loja</span>
      </p>

      <div className="relative mt-6 flex w-105 max-w-full">
        <Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, telefone ou email" className="h-10.5" />
      </div>

      {loading ? (
        <div className="mt-14 flex justify-center">
          <Loader2 size={22} className="animate-spin text-primary" />
        </div>
      ) : linhas.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-white">
          <div className="grid grid-cols-[minmax(180px,1.6fr)_minmax(150px,1.1fr)_90px_minmax(130px,1fr)_minmax(150px,1.1fr)] items-center gap-3 border-b border-border bg-paper px-5 text-xs font-medium uppercase tracking-wider text-ink-soft" style={{ height: 44 }}>
            <div>Cliente</div>
            <div>Telefone</div>
            <SortHeader label="Pedidos" active={ordem === "pedidos"} desc={desc} onClick={() => ordenarPor("pedidos")} />
            <SortHeader label="Gastou" active={ordem === "gastou"} desc={desc} onClick={() => ordenarPor("gastou")} align="right" />
            <SortHeader label="Último pedido" active={ordem === "ultimo"} desc={desc} onClick={() => ordenarPor("ultimo")} />
          </div>
          {linhas.map(({ c, pedidosC, gastou, ultimoTexto, emAberto, estadoCor }) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => selecionar(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selecionar(c.id);
                }
              }}
              className="grid min-h-14 cursor-pointer grid-cols-[minmax(180px,1.6fr)_minmax(150px,1.1fr)_90px_minmax(130px,1fr)_minmax(150px,1.1fr)] items-center gap-3 border-b border-border px-5 transition-colors hover:bg-black/[0.02]"
            >
              <div className="text-sm font-medium">{c.nome}</div>
              <div className="font-mono text-sm text-ink-soft">{c.telefone}</div>
              <div className="font-mono text-sm text-ink-soft">{pedidosC.length}</div>
              <div className="whitespace-nowrap text-right font-mono text-sm">{formatBRL(gastou)}</div>
              <div className="flex items-center gap-1.5 text-[13px] text-ink-soft">
                {emAberto && <StatusDot color={estadoCor} />}
                {ultimoTexto}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-border bg-white px-6 py-14 text-center">
          <div className="text-base font-semibold">Ninguém com esse nome ou número.</div>
          <div className="mt-1.5 text-sm text-ink-soft">Confira a busca — o cliente pode ter cadastrado outro telefone.</div>
        </div>
      )}

      <AnimatePresence>
        {selecionado && (
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setSelId(null);
              setEditando(false);
            }}
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
              className="flex h-full w-120 max-w-full flex-col overflow-y-auto bg-white shadow-[-8px_0_28px_rgba(16,24,40,0.14)]"
            >
              <div className="border-b border-border p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[22px] font-semibold tracking-tight">{selecionado.nome}</div>
                    <div className="mt-1 text-[13px] text-ink-soft">Cliente desde {selecionado.desde}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => selIndex > 0 && selecionar(linhas[selIndex - 1].c.id)}
                      disabled={selIndex <= 0}
                      aria-label="Cliente anterior"
                      className={cn("flex h-7.5 w-7.5 items-center justify-center rounded-md border border-border bg-white text-ink-soft", selIndex <= 0 ? "cursor-not-allowed opacity-40" : "cursor-pointer")}
                    >
                      <ChevronUp size={15} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => selIndex < linhas.length - 1 && selecionar(linhas[selIndex + 1].c.id)}
                      disabled={selIndex >= linhas.length - 1}
                      aria-label="Próximo cliente"
                      className={cn("flex h-7.5 w-7.5 items-center justify-center rounded-md border border-border bg-white text-ink-soft", selIndex >= linhas.length - 1 ? "cursor-not-allowed opacity-40" : "cursor-pointer")}
                    >
                      <ChevronDown size={15} strokeWidth={2} />
                    </button>
                    <button type="button" onClick={() => setSelId(null)} aria-label="Fechar" className="flex h-7.5 w-7.5 cursor-pointer items-center justify-center border-0 bg-transparent text-lg leading-none text-ink-soft">
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <a
                  href={whatsappLink(selecionado.telefone, `Olá ${selecionado.nome.split(" ")[0]}, tudo bem? Aqui é da Nova Era Tintas.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4.5 flex h-10.5 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-[1.5px] border-primary bg-transparent font-sans text-sm font-semibold text-primary transition-colors hover:bg-primary-tint"
                >
                  <MessageCircle size={17} strokeWidth={1.8} />
                  Falar no WhatsApp
                </a>
              </div>

              <div className="grid grid-cols-3 border-b border-border">
                <Stat label="Pedidos" value={String(pedidosSelecionado.length)} />
                <Stat label="Gastou" value={formatBRL(gastouSelecionado)} bordered />
                <Stat label="Último" value={pedidosSelecionado[0] ? humano(diasDesde(pedidosSelecionado[0].criadoEm)) : "nunca"} bordered />
              </div>

              <div className="border-b border-border p-6">
                <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-soft">O que ele já levou</div>
                {levouSelecionado.length > 0 ? (
                  <>
                    <motion.div variants={staggerContainer(0.04)} initial="hidden" animate="visible" className="flex flex-col">
                      {(verLevou ? levouSelecionado : levouSelecionado.slice(0, 3)).map((l, i) => (
                        <motion.a
                          key={i}
                          variants={staggerItem}
                          href="/produtos"
                          className="net-item -mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 no-underline transition-colors"
                        >
                          <span className="mt-0.75 h-3.5 w-3.5 shrink-0 rounded-[3px] border border-black/10 bg-paper" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-ink">{l.nome}</span>
                            <span className="mt-0.5 flex items-baseline gap-3">
                              <span className="flex-1 text-[13px] text-ink-soft">{l.variacao}</span>
                              <span className="font-mono text-[13px] text-ink-soft">{l.vezes}×</span>
                              <span className="whitespace-nowrap text-xs text-ink-soft">{fmtDataBr(l.ultima)}</span>
                            </span>
                          </span>
                        </motion.a>
                      ))}
                    </motion.div>
                    {levouSelecionado.length > 3 && (
                      <button type="button" onClick={() => setVerLevou((v) => !v)} className="mt-2.5 cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-primary">
                        {verLevou ? "Ver menos" : `Ver todos (${levouSelecionado.length})`}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-ink-soft">Ainda não levou nada.</div>
                )}
              </div>

              <div className="border-b border-border p-6">
                <div className="mb-3.5 flex items-center justify-between">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Contato</div>
                  {!editando && (
                    <button
                      type="button"
                      onClick={() => {
                        setRascunho({ nome: selecionado.nome, telefone: selecionado.telefone, email: selecionado.email });
                        setEditando(true);
                      }}
                      className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-primary"
                    >
                      Editar
                    </button>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  {!editando ? (
                    <motion.div key="read" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3.5">
                      <ContatoField label="Nome completo" value={selecionado.nome} />
                      <ContatoField label="Telefone / WhatsApp" value={selecionado.telefone} mono />
                      <ContatoField label="Email" value={selecionado.email} />
                    </motion.div>
                  ) : (
                    <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3.5">
                      <div>
                        <div className="mb-1.5 text-xs text-ink-soft">Nome completo</div>
                        <Input value={rascunho?.nome ?? ""} onChange={(e) => setRascunho((r) => (r ? { ...r, nome: e.target.value } : r))} className="h-10" />
                      </div>
                      <div>
                        <div className="mb-1.5 text-xs text-ink-soft">Telefone / WhatsApp</div>
                        <Input value={rascunho?.telefone ?? ""} onChange={(e) => setRascunho((r) => (r ? { ...r, telefone: e.target.value } : r))} className="h-10 font-mono" />
                      </div>
                      <div>
                        <div className="mb-1.5 text-xs text-ink-soft">Email</div>
                        <Input value={rascunho?.email ?? ""} onChange={(e) => setRascunho((r) => (r ? { ...r, email: e.target.value } : r))} className="h-10" />
                      </div>
                      <div className="mt-0.5 flex justify-end gap-3">
                        <Button variant="ghost" className="h-9.5" onClick={() => setEditando(false)}>
                          Cancelar
                        </Button>
                        <Button
                          className="h-9.5"
                          loading={salvandoContato}
                          onClick={async () => {
                            if (!rascunho) return;
                            setSalvandoContato(true);
                            await atualizarCliente(selecionado.id, rascunho);
                            setSalvandoContato(false);
                            setEditando(false);
                            showToast("Cadastro salvo");
                          }}
                        >
                          Salvar
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="border-b border-border p-6">
                <div className="mb-3.5 flex items-center justify-between">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Endereços</div>
                  {!addEnd && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditEndId(null);
                        setAddEnd(true);
                      }}
                      className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-primary"
                    >
                      + Adicionar
                    </button>
                  )}
                </div>

                <motion.div variants={staggerContainer(0.05)} initial="hidden" animate="visible" className="flex flex-col gap-2.5">
                  {selecionado.enderecos.map((e) =>
                    editEndId === e.id ? (
                      <div key={e.id} className="rounded-[10px] border border-primary bg-primary-tint p-3.5">
                        <EnderecoFormFields value={editEndForm} onChange={setEditEndForm} />
                        <div className="mt-2.5 flex justify-end gap-3">
                          <Button variant="ghost" className="h-9" onClick={() => setEditEndId(null)}>
                            Cancelar
                          </Button>
                          <Button
                            className="h-9"
                            loading={salvandoEnd}
                            onClick={async () => {
                              if (!editEndForm.rotulo.trim()) return;
                              setSalvandoEnd(true);
                              const atualizado: EnderecoCliente = {
                                ...e,
                                rotulo: editEndForm.rotulo,
                                texto: enderecoParaTexto(editEndForm),
                                cep: editEndForm.cep,
                                uf: editEndForm.uf,
                                cidade: editEndForm.cidade,
                                bairro: editEndForm.bairro,
                                rua: editEndForm.rua,
                                numero: editEndForm.numero,
                                complemento: editEndForm.complemento,
                              };
                              await atualizarCliente(selecionado.id, {
                                enderecos: selecionado.enderecos.map((x) => (x.id === e.id ? atualizado : x)),
                              });
                              setSalvandoEnd(false);
                              setEditEndId(null);
                              showToast("Endereço atualizado");
                            }}
                          >
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <motion.div key={e.id} variants={staggerItem} className="flex items-start gap-3 rounded-[10px] border p-3.5" style={{ borderColor: e.principal ? "#12B76A" : "#E4E7EC" }}>
                        <button
                          type="button"
                          onClick={() =>
                            atualizarCliente(selecionado.id, {
                              enderecos: selecionado.enderecos.map((x) => ({ ...x, principal: x.id === e.id })),
                            }).then(() => showToast("Endereço principal atualizado"))
                          }
                          disabled={e.principal}
                          aria-label={`Tornar ${e.rotulo} principal`}
                          className={cn("mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 bg-transparent p-0", e.principal ? "cursor-default" : "cursor-pointer")}
                          style={{ borderColor: e.principal ? "#12B76A" : "#D0D5DD" }}
                        >
                          {e.principal && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{e.rotulo}</span>
                            {e.principal && (
                              <span className="rounded-full border border-[#A6F4C5] bg-primary-tint px-2 py-0.25 text-[11px] font-medium text-primary">Principal</span>
                            )}
                          </div>
                          <div className="mt-0.75 text-[13px] text-ink-soft text-pretty">{e.texto}</div>
                          <div className="mt-2 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setEditEndForm(enderecoDeCliente(e));
                                setEditEndId(e.id);
                                setAddEnd(false);
                              }}
                              className="cursor-pointer border-0 bg-transparent p-0 font-sans text-xs font-medium text-primary"
                            >
                              Editar
                            </button>
                            {!e.principal && (
                              <button
                                type="button"
                                onClick={() =>
                                  atualizarCliente(selecionado.id, {
                                    enderecos: selecionado.enderecos.filter((x) => x.id !== e.id),
                                  }).then(() => showToast("Endereço removido"))
                                }
                                className="cursor-pointer border-0 bg-transparent p-0 font-sans text-xs font-medium text-danger"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  )}
                </motion.div>

                <AnimatePresence>
                  {addEnd && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 overflow-hidden rounded-[10px] border border-primary bg-primary-tint p-3.5"
                    >
                      <div className="mb-3 text-sm font-semibold">Novo endereço</div>
                      <EnderecoFormFields value={novoEnd} onChange={setNovoEnd} />
                      <Button
                        className="mt-3 h-10 w-full"
                        loading={salvandoEnd}
                        onClick={async () => {
                          if (!novoEnd.rotulo.trim()) return;
                          setSalvandoEnd(true);
                          const novo: EnderecoCliente = {
                            id: `e${Date.now()}`,
                            rotulo: novoEnd.rotulo,
                            texto: enderecoParaTexto(novoEnd),
                            principal: selecionado.enderecos.length === 0,
                            cep: novoEnd.cep,
                            uf: novoEnd.uf,
                            cidade: novoEnd.cidade,
                            bairro: novoEnd.bairro,
                            rua: novoEnd.rua,
                            numero: novoEnd.numero,
                            complemento: novoEnd.complemento,
                          };
                          await atualizarCliente(selecionado.id, { enderecos: [...selecionado.enderecos, novo] });
                          setSalvandoEnd(false);
                          setAddEnd(false);
                          setNovoEnd(ENDERECO_VAZIO);
                          showToast("Endereço adicionado");
                        }}
                      >
                        + Adicionar Endereço
                      </Button>
                      <button type="button" onClick={() => { setAddEnd(false); setNovoEnd(ENDERECO_VAZIO); }} className="mt-2.5 w-full cursor-pointer border-0 bg-transparent p-0 text-center font-sans text-[13px] font-medium text-ink-soft">
                        Cancelar
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {pedidosSelecionado.some((p) => FROZEN_STATES.has(p.estado)) && (
                  <div className="mt-3.5 flex gap-2.5 rounded-lg border border-border bg-paper p-3">
                    <Lock size={15} strokeWidth={1.9} className="mt-0.5 shrink-0 text-ink-soft" />
                    <span className="text-xs text-ink-soft text-pretty">
                      Pedidos pagos mantêm o endereço que valia na hora. Trocar aqui só vale pros próximos pedidos.
                    </span>
                  </div>
                )}

                {selecionado.historicoEnderecos.length > 0 && (
                  <div className="mt-3.5">
                    <button type="button" onClick={() => setVerHistorico((v) => !v)} className="cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-ink-soft">
                      {verHistorico ? "Ocultar endereços anteriores" : "Ver endereços anteriores"}
                    </button>
                    <AnimatePresence>
                      {verHistorico && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2.5 flex flex-col gap-2 overflow-hidden">
                          {selecionado.historicoEnderecos.map((h, i) => (
                            <div key={i} className="border-l-2 border-border pl-3 text-[13px] text-ink-soft text-pretty">
                              {h}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <div className="p-6">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-soft">Pedidos</div>
                <motion.div variants={staggerContainer(0.05)} initial="hidden" animate="visible" className="flex flex-col">
                  {(verPedidos ? pedidosSelecionado : pedidosSelecionado.slice(0, 3)).map((p) => {
                    const info = ESTADO_INFO[p.estado] ?? { rotulo: p.estado, cor: "#667085" };
                    const total = p.itens.reduce((s, it) => s + it.preco * it.qtd, 0) + p.frete;
                    return (
                      <motion.a key={p.id} variants={staggerItem} href="/pedidos" className="net-item -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.75 no-underline">
                        <span className="font-mono text-sm text-ink">{p.numero}</span>
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-ink-soft">
                          <StatusDot color={info.cor} />
                          {info.rotulo}
                        </span>
                        <span className="whitespace-nowrap text-xs text-ink-soft">{fmtDataBr(p.criadoEm)}</span>
                        <span className="min-w-23 whitespace-nowrap text-right font-mono text-sm">{formatBRL(total)}</span>
                      </motion.a>
                    );
                  })}
                </motion.div>
                {pedidosSelecionado.length > 3 && (
                  <button type="button" onClick={() => setVerPedidos((v) => !v)} className="mt-2.5 cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] font-medium text-primary">
                    {verPedidos ? "Ver menos" : `Ver todos (${pedidosSelecionado.length})`}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function SortHeader({ label, active, desc, onClick, align }: { label: string; active: boolean; desc: boolean; onClick: () => void; align?: "right" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("net-sort flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium uppercase tracking-wider transition-colors", align === "right" && "justify-end")}
      style={{ color: active ? "#101828" : "#667085" }}
    >
      {label} <span className="text-[9px]">{active ? (desc ? "▼" : "▲") : ""}</span>
    </button>
  );
}

function Stat({ label, value, bordered }: { label: string; value: string; bordered?: boolean }) {
  return (
    <div className={cn("p-4.5", bordered && "border-l border-border")}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="mt-1.5 whitespace-nowrap font-mono text-xl">{value}</div>
    </div>
  );
}

function EnderecoFormFields({ value, onChange }: { value: EnderecoForm; onChange: (updater: (v: EnderecoForm) => EnderecoForm) => void }) {
  function set<K extends keyof EnderecoForm>(campo: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) => onChange((v) => ({ ...v, [campo]: e.target.value }));
  }
  return (
    <div className="flex flex-col gap-2.5">
      <Input value={value.rotulo} onChange={set("rotulo")} placeholder="Rótulo (ex: Casa, Trabalho)" className="h-9.5" />
      <div className="flex gap-2.5">
        <Input value={value.cep} onChange={set("cep")} placeholder="CEP" className="h-9.5 flex-[2]" />
        <Input value={value.uf} onChange={set("uf")} placeholder="UF" maxLength={2} className="h-9.5 flex-1 uppercase" />
      </div>
      <Input value={value.cidade} onChange={set("cidade")} placeholder="Cidade" className="h-9.5" />
      <Input value={value.bairro} onChange={set("bairro")} placeholder="Bairro" className="h-9.5" />
      <div className="flex gap-2.5">
        <Input value={value.rua} onChange={set("rua")} placeholder="Rua / Avenida" className="h-9.5 flex-[2]" />
        <Input value={value.numero} onChange={set("numero")} placeholder="Número" className="h-9.5 flex-1" />
      </div>
      <Input value={value.complemento} onChange={set("complemento")} placeholder="Complemento (opcional)" className="h-9.5" />
    </div>
  );
}

function ContatoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-ink-soft">{label}</div>
      <div className={cn("mt-0.5 text-sm", mono && "font-mono")}>{value}</div>
    </div>
  );
}
