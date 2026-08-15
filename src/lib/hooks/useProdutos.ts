"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Produto } from "@/lib/types";

export function useProdutos(): { produtos: Produto[]; loading: boolean } {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "produtos"), orderBy("nome", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setProdutos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Produto));
        setLoading(false);
      },
      () => {
        setProdutos([]);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  return { produtos, loading };
}
