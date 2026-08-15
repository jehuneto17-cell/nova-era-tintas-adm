"use client";

import { motion } from "framer-motion";
import { spring } from "@/lib/animations";

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  "aria-label"?: string;
}

export function Switch({ checked, onChange, "aria-label": ariaLabel }: SwitchProps) {
  return (
    <span
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange();
        }
      }}
      className="relative inline-block h-5 w-9 cursor-pointer rounded-full transition-colors duration-150"
      style={{ background: checked ? "#12B76A" : "#E4E7EC" }}
    >
      <motion.span
        layout
        transition={spring}
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white"
        style={{ left: checked ? 18 : 2 }}
      />
    </span>
  );
}
