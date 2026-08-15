"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface SettingsCardProps {
  id: string;
  title: string;
  description: string;
  editable?: boolean;
  editing?: boolean;
  onEdit?: () => void;
  headerRight?: ReactNode;
  children: ReactNode;
}

export function SettingsCard({
  id,
  title,
  description,
  editable,
  editing,
  onEdit,
  headerRight,
  children,
}: SettingsCardProps) {
  return (
    <section id={id} className="rounded-xl border border-border bg-white p-7">
      <div className="flex items-start justify-between gap-5">
        <div>
          <h2 className="m-0 text-lg font-semibold">{title}</h2>
          <p className="mt-1 mb-0 text-sm text-ink-soft">{description}</p>
        </div>
        {headerRight}
        {editable && !editing && (
          <motion.button
            type="button"
            onClick={onEdit}
            whileTap={{ scale: 0.96 }}
            className="shrink-0 cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-medium text-primary"
          >
            Editar
          </motion.button>
        )}
      </div>
      {children}
    </section>
  );
}
