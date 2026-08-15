"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Cliente } from "@/lib/types";

export function useClientes(): { clientes: Cliente[]; loading: boolean } {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "clientes"), orderBy("nome", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setClientes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Cliente));
        setLoading(false);
      },
      () => {
        setClientes([]);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  return { clientes, loading };
}
