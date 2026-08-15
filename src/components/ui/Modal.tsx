"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { modalBackdrop, modalContent } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}

export function Modal({ open, onClose, children, maxWidth = 440 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          variants={modalBackdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,24,40,0.4)] p-6"
        >
          <motion.div
            key="content"
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{ maxWidth }}
            className={cn("w-full rounded-xl bg-white p-6 shadow-[0_16px_40px_rgba(16,24,40,0.18)]")}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ModalTitle({ children }: { children: ReactNode }) {
  return <h3 className="m-0 text-lg font-semibold">{children}</h3>;
}

export function ModalBody({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-sm text-ink-soft text-pretty">{children}</p>;
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="mt-5.5 flex justify-end gap-3">{children}</div>;
}
