"use client";

import { Loader2 } from "lucide-react";
import { usePedidos } from "@/lib/hooks/usePedidos";
import { formatBRL } from "@/lib/utils";
import { StatusDot } from "@/components/ui/StatusDot";
import type { Pedido, PedidoEstado } from "@/lib/types";

const ESTADOS_VENDIDOS: PedidoEstado[] = ["pago", "separacao", "enviado", "entregue"];

function totalPedido(p: Pedido) {
  return p.itens.reduce((a, it) => a + it.preco * it.qtd, 0) + p.frete;
}

function inicioDoDia(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function DashboardPage() {
  const { pedidos, loading } = usePedidos();

  const vendidos = pedidos.filter((p) => ESTADOS_VENDIDOS.includes(p.estado));

  const hoje = inicioDoDia(new Date());
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const vendidosHoje = vendidos.filter((p) => new Date(p.criadoEm) >= hoje);
  const vendidosMes = vendidos.filter((p) => new Date(p.criadoEm) >= inicioMes);

  const totalHoje = vendidosHoje.reduce((a, p) => a + totalPedido(p), 0);
  const totalMes = vendidosMes.reduce((a, p) => a + totalPedido(p), 0);
  const ticketMedioMes = vendidosMes.length > 0 ? totalMes / vendidosMes.length : 0;

  // últimos 7 dias, incluindo hoje
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const porDia = dias.map((d) => {
    const fimDia = new Date(d);
    fimDia.setDate(fimDia.getDate() + 1);
    const total = vendidos
      .filter((p) => {
        const t = new Date(p.criadoEm);
        return t >= d && t < fimDia;
      })
      .reduce((a, p) => a + totalPedido(p), 0);
    return { data: d, total };
  });
  const maiorDia = Math.max(1, ...porDia.map((d) => d.total));

  if (loading) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center">
        <Loader2 size={22} className="animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-w-0 flex-1 p-10">
      <h1 className="m-0 text-[30px] font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1.5 text-[15px] text-ink-soft">Resumo de vendas da loja.</p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <KpiCard label="Vendido hoje" valor={formatBRL(totalHoje)} sub={`${vendidosHoje.length} pedidos`} />
        <KpiCard label="Vendido no mês" valor={formatBRL(totalMes)} sub={`${vendidosMes.length} pedidos`} />
        <KpiCard label="Ticket médio no mês" valor={formatBRL(ticketMedioMes)} sub="por pedido" />
      </div>

      <div className="mt-5 rounded-xl border border-border bg-white p-6">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Últimos 7 dias</div>
        <div className="mt-5 flex h-40 items-end gap-3">
          {porDia.map(({ data, total }) => (
            <div key={data.toISOString()} className="flex flex-1 flex-col items-center gap-2">
              <span className="font-mono text-xs text-ink-soft">{total > 0 ? formatBRL(total) : ""}</span>
              <div
                className="w-full rounded-t-md bg-primary/80"
                style={{ height: `${Math.max(4, (total / maiorDia) * 100)}%` }}
              />
              <span className="text-xs text-ink-soft">
                {data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-white">
        <div className="grid grid-cols-[100px_minmax(160px,1.6fr)_minmax(140px,1fr)_minmax(120px,1fr)] items-center gap-3 border-b border-border bg-paper px-5 text-xs font-medium uppercase tracking-wider text-ink-soft" style={{ height: 44 }}>
          <div>Pedido</div>
          <div>Cliente</div>
          <div>Quando</div>
          <div className="text-right">Total</div>
        </div>
        {vendidos.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="text-base font-semibold">Nenhuma venda ainda.</div>
            <div className="mt-1.5 text-sm text-ink-soft">Quando um pedido for pago, ele aparece aqui.</div>
          </div>
        ) : (
          [...vendidos]
            .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
            .slice(0, 8)
            .map((p) => (
              <div
                key={p.id}
                className="grid min-h-14 grid-cols-[100px_minmax(160px,1.6fr)_minmax(140px,1fr)_minmax(120px,1fr)] items-center gap-3 border-b border-border px-5 last:border-b-0"
              >
                <div className="font-mono text-sm">{p.numero}</div>
                <div className="text-sm font-medium">{p.cliente}</div>
                <div className="flex items-center gap-1.5 text-[13px] text-ink-soft">
                  <StatusDot color="#12B76A" />
                  {new Date(p.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </div>
                <div className="whitespace-nowrap text-right font-mono text-sm">{formatBRL(totalPedido(p))}</div>
              </div>
            ))
        )}
      </div>
    </main>
  );
}

function KpiCard({ label, valor, sub }: { label: string; valor: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold">{valor}</div>
      <div className="mt-1 text-[13px] text-ink-soft">{sub}</div>
    </div>
  );
}
