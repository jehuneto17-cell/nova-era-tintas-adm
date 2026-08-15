"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { heightAuto } from "@/lib/animations";

export function AnimatedSection({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          variants={heightAuto}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
