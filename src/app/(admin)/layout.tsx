"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/admin/Sidebar";
import { PageTransition } from "@/components/admin/PageTransition";
import { useComprovantesPendentes } from "@/lib/hooks/useComprovantesPendentes";
import { Spinner } from "@/components/ui/Spinner";

// DEV-ONLY: lets screens be previewed without live Firebase Auth.
// Inert unless NEXT_PUBLIC_DEV_BYPASS_AUTH=1 is set locally, and NODE_ENV
// guards it out of production builds entirely. Remove before shipping,
// or just leave the env var unset — it does nothing by default.
const DEV_BYPASS_AUTH =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pendentes = useComprovantesPendentes();

  useEffect(() => {
    if (!loading && !user && !DEV_BYPASS_AUTH) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if ((loading || !user) && !DEV_BYPASS_AUTH) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Spinner className="h-6 w-6 border-primary/25 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start">
      <Sidebar pendentesConferencia={pendentes} />
      <div className="min-w-0 flex-1">
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
