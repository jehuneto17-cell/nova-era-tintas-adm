"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Search, Check } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Modal, ModalTitle } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useCoresCoral } from "@/lib/hooks/useCores";
import { isValidHexColor } from "@/lib/utils";
import type { CorTinta } from "@/lib/types";

export default function CoresCoralPage() {
  const { showToast } = useToast();
  const { cores, loading } = useCoresCoral();
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<CorTinta | null>(null);

  const buscaNorm = busca.trim().toLowerCase();

  const filtradas = useMemo(() => {
    if (!buscaNorm) return cores;
    return cores.filter(
      (c) => c.nome.toLowerCase().includes(buscaNorm) || c.codigo.toLowerCase().includes(buscaNorm)
    );
  }, [cores, buscaNorm]);

  async function atualizar(id: string, patch: Partial<CorTinta>) {
    try {
      await updateDoc(doc(db, "cores_coral", id), patch);
    } catch {
      showToast("Não deu para salvar. Tente de novo.");
    }
  }

  return (
    <main className="min-w-0 flex-1 p-10">
      <div className="mb-1.5 text-[13px] text-ink-soft">
        <Link href="/produtos" className="no-underline">
          Produtos
        </Link>
        <span className="mx-1.5">/</span>Cores Coral
      </div>
      <h1 className="m-0 text-[30px] font-semibold tracking-tight">Cores Coral</h1>
      <p className="mt-1.5 max-w-215 text-[15px] text-ink-soft text-pretty">
        Paleta de cores Coral ({cores.length.toLocaleString("pt-BR")} cores). Usada em produtos que optam por
        &ldquo;Cores Coral&rdquo; nas variações — busque por nome ou código para conferir ou corrigir uma cor.
      </p>

      <div className="relative mt-6 flex w-96 max-w-full">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-3 text-ink-soft" strokeWidth={2} />
        <Input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou código (ex: Verde Kiwi, FO 654)"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="mt-14 flex justify-center">
          <Loader2 size={22} className="animate-spin text-primary" />
        </div>
      ) : filtradas.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">Nenhuma cor encontrada para &ldquo;{busca}&rdquo;.</p>
      ) : (
        <div className="mt-6 max-w-215 overflow-hidden rounded-xl border border-border bg-white">
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
            {filtradas.map((cor) => (
              <div key={cor.id} className="flex items-center gap-3 bg-white px-4.5 py-2.5">
                <span
                  className="h-7 w-7 shrink-0 rounded-md border border-black/10"
                  style={{ background: cor.hex }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{cor.nome}</div>
                  <div className="font-mono text-[11px] text-ink-soft">
                    {cor.codigo} · {cor.hex}
                  </div>
                </div>
                <Switch
                  checked={cor.ativa}
                  onChange={() => atualizar(cor.id, { ativa: !cor.ativa })}
                  aria-label={`Ativar/desativar ${cor.nome}`}
                />
                <button
                  type="button"
                  onClick={() => setEditando(cor)}
                  aria-label={`Editar ${cor.nome}`}
                  className="net-x cursor-pointer border-0 bg-transparent p-1 text-ink-soft transition-colors"
                >
                  <Pencil size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <EditarCorModal cor={editando} onClose={() => setEditando(null)} onSalvar={atualizar} />
    </main>
  );
}

function EditarCorModal({
  cor,
  onClose,
  onSalvar,
}: {
  cor: CorTinta | null;
  onClose: () => void;
  onSalvar: (id: string, patch: Partial<CorTinta>) => Promise<void>;
}) {
  return (
    <Modal open={!!cor} onClose={onClose} maxWidth={400}>
      {cor && <EditarCorForm key={cor.id} cor={cor} onClose={onClose} onSalvar={onSalvar} />}
    </Modal>
  );
}

function EditarCorForm({
  cor,
  onClose,
  onSalvar,
}: {
  cor: CorTinta;
  onClose: () => void;
  onSalvar: (id: string, patch: Partial<CorTinta>) => Promise<void>;
}) {
  const [nome, setNome] = useState(cor.nome);
  const [hex, setHex] = useState(cor.hex.toUpperCase());
  const [salvando, setSalvando] = useState(false);

  const hexValido = isValidHexColor(hex);

  async function salvar() {
    if (!hexValido || !nome.trim()) return;
    setSalvando(true);
    try {
      await onSalvar(cor.id, { nome: nome.trim(), hex: hex.toUpperCase() });
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <ModalTitle>Editar cor</ModalTitle>
      <div className="mt-2.5">
        <div className="flex flex-col gap-3.5">
          <div className="font-mono text-xs text-ink-soft">Código {cor.codigo}</div>
          <div>
            <div className="mb-1.5 text-[13px] font-medium">Nome</div>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-medium">Cor (hex)</div>
            <div className="flex items-center gap-2.5">
              <span
                className="h-8 w-8 shrink-0 rounded-md border border-black/10"
                style={{ background: hexValido ? hex : "#fff" }}
              />
              <Input
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                error={!hexValido}
                className="flex-1 font-mono text-sm"
              />
              {hexValido && <Check size={15} className="shrink-0 text-primary" strokeWidth={2.4} />}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5.5 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button loading={salvando} disabled={!hexValido || !nome.trim()} onClick={salvar}>
          Salvar
        </Button>
      </div>
    </>
  );
}
