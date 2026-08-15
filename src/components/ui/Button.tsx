"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Spinner } from "./Spinner";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "danger-outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "bg-white border border-border text-[#344054] hover:border-[#D0D5DD]",
  outline: "bg-transparent border-[1.5px] border-primary text-primary hover:bg-primary-tint",
  ghost: "bg-transparent text-ink-soft hover:text-ink",
  danger: "bg-danger text-white hover:brightness-95",
  "danger-outline": "bg-transparent border border-danger text-danger hover:bg-danger-bg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading, disabled, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 font-sans text-sm font-semibold cursor-pointer transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {loading && <Spinner className={variant === "primary" || variant === "danger" ? "border-white/35 border-t-white" : "border-primary/30 border-t-primary"} />}
      {children}
    </button>
  );
});
