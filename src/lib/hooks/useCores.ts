"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CorTinta } from "@/lib/types";

function useColecaoCores(nomeColecao: string, ordenarPorFamilia: boolean): { cores: CorTinta[]; loading: boolean } {
  const [cores, setCores] = useState<CorTinta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = ordenarPorFamilia
      ? query(collection(db, nomeColecao), orderBy("familia", "asc"), orderBy("nome", "asc"))
      : query(collection(db, nomeColecao), orderBy("nome", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCores(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CorTinta));
        setLoading(false);
      },
      () => {
        setCores([]);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [nomeColecao, ordenarPorFamilia]);

  return { cores, loading };
}

export function useCores(): { cores: CorTinta[]; loading: boolean } {
  return useColecaoCores("cores", true);
}

export function useCoresCoral(): { cores: CorTinta[]; loading: boolean } {
  return useColecaoCores("cores_coral", false);
}
