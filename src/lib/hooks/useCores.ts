"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CorTinta } from "@/lib/types";

export function useCores(): { cores: CorTinta[]; loading: boolean } {
  const [cores, setCores] = useState<CorTinta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "cores"), orderBy("familia", "asc"), orderBy("nome", "asc"));
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
  }, []);

  return { cores, loading };
}
