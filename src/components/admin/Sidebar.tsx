"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutGrid, ClipboardList, BadgeCheck, User, Settings, Palette, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth, ADMIN_EMAIL } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { pulse } from "@/lib/animations";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/produtos", label: "Produtos", icon: LayoutGrid, badge: false },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList, badge: false },
  { href: "/conferencia", label: "Conferência", icon: BadgeCheck, badge: true },
  { href: "/clientes", label: "Clientes", icon: User, badge: false },
  { href: "/configuracoes", label: "Configurações", icon: Settings, badge: false },
  { href: "/branding", label: "Branding", icon: Palette, badge: false },
] as const;

export function Sidebar({ pendentesConferencia = 0 }: { pendentesConferencia?: number }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const initials =
    user?.email
      ?.split("@")[0]
      .slice(0, 2)
      .toUpperCase() ?? "AD";

  return (
    <aside className="sticky top-0 flex h-screen w-55 shrink-0 flex-col bg-sidebar p-3">
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-[13px] font-bold text-white">
          NET
        </div>
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium no-underline transition-colors duration-150",
                active ? "bg-primary text-white" : "text-white/85 hover:bg-white/6 hover:text-white"
              )}
            >
              <Icon size={18} strokeWidth={1.8} />
              {item.label}
              {item.badge && pendentesConferencia > 0 && (
                <motion.span
                  variants={pulse}
                  animate="animate"
                  className="ml-auto rounded-full bg-status-amber px-[7px] py-0.5 font-mono text-[11px] font-medium text-white"
                >
                  {pendentesConferencia}
                </motion.span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t border-white/12 pt-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">Admin</div>
          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-white/60">
            {user?.email ?? ADMIN_EMAIL}
          </div>
        </div>
        <button
          type="button"
          aria-label="Sair"
          onClick={() => signOut(auth)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <LogOut size={15} strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  );
}
