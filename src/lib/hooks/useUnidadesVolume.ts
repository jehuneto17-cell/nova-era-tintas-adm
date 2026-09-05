"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const UNIDADES_PADRAO = ["L", "mL", "Kg", "G", "Unid."];
const ref = doc(db, "configuracoes", "produtos");

export function useUnidadesVolume(): { unidades: string[]; loading: boolean } {
  const [unidades, setUnidades] = useState<string[]>(UNIDADES_PADRAO);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        setUnidades(data?.unidadesVolume?.length ? data.unidadesVolume : UNIDADES_PADRAO);
        setLoading(false);
      },
      () => {
        setUnidades(UNIDADES_PADRAO);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  return { unidades, loading };
}

export async function salvarUnidadesVolume(unidades: string[]) {
  await setDoc(ref, { unidadesVolume: unidades }, { merge: true });
}
