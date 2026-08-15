"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Pedido } from "@/lib/types";

export function usePedidos(): { pedidos: Pedido[]; loading: boolean } {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "pedidos"), orderBy("criadoEm", "desc"));
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
  }, []);

  return { pedidos, loading };
}
