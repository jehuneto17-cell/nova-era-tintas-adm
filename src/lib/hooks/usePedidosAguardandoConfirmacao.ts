"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Pedido } from "@/lib/types";

export function usePedidosAguardandoConfirmacao(): { pedidos: Pedido[]; loading: boolean } {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ordenação em memória (não no Firestore): orderBy() excluiria pedidos
    // sem comprovanteEnviadoEm preenchido, sumindo da lista de conferência
    const q = query(collection(db, "pedidos"), where("estado", "==", "aguardando_confirmacao"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Pedido);
        lista.sort((a, b) => {
          const ta = a.comprovanteEnviadoEm ? new Date(a.comprovanteEnviadoEm).getTime() : 0;
          const tb = b.comprovanteEnviadoEm ? new Date(b.comprovanteEnviadoEm).getTime() : 0;
          return ta - tb;
        });
        setPedidos(lista);
        setLoading(false);
      },
      () => {
        setPedidos([]);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  return { pedidos, loading };
}
