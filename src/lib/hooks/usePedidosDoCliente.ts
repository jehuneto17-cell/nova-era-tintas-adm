"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Pedido } from "@/lib/types";

export function usePedidosDoCliente(clienteId: string | null): { pedidos: Pedido[]; loading: boolean } {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clienteId) return;
    const q = query(collection(db, "pedidos"), where("clienteId", "==", clienteId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPedidos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Pedido));
        setLoading(false);
      },
      () => {
        setPedidos([]);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [clienteId]);

  return { pedidos, loading };
}
