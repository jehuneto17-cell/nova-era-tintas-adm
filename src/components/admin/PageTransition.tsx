"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { fadeIn } from "@/lib/animations";

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}
