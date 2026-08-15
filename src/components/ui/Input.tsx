"use client";

import { forwardRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { motion } from "framer-motion";
import { shake } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  success?: boolean;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

export function FieldWrapper({ label, error, success, hint, htmlFor, children }: FieldWrapperProps) {
  const [shakeKey, setShakeKey] = useState(0);
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
          {label}
        </label>
      )}
      <motion.div
        key={error ? `err-${shakeKey}` : "ok"}
        variants={shake}
        initial="initial"
        animate={error ? "shake" : "initial"}
        onAnimationStart={() => error && setShakeKey((k) => k + 1)}
      >
        {children}
      </motion.div>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 text-xs text-danger"
        >
          {error}
        </motion.div>
      )}
      {!error && success && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-primary">
          ✓ válido
        </motion.div>
      )}
      {!error && hint && <span className="text-xs text-ink-soft">{hint}</span>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border bg-white px-3.5 font-sans text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150",
        "placeholder:text-[#98A2B3]",
        "focus:border-primary focus:shadow-[0_0_0_3px_rgba(18,183,106,0.12)]",
        error ? "border-danger" : "border-border",
        className
      )}
      {...props}
    />
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { error, className, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-y rounded-lg border bg-white px-3.5 py-3 font-sans text-sm leading-relaxed text-ink outline-none transition-[border-color,box-shadow] duration-150",
        "focus:border-primary focus:shadow-[0_0_0_3px_rgba(18,183,106,0.12)]",
        error ? "border-danger" : "border-border",
        className
      )}
      {...props}
    />
  );
});
