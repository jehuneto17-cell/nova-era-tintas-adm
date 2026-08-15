"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useComprovantesPendentes(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "pedidos"), where("estado", "==", "aguardando_confirmacao"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => setCount(snapshot.size),
      () => setCount(0)
    );
    return unsubscribe;
  }, []);

  return count;
}
