"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  className?: string;
  minHeight?: number;
}

const TOOLBAR_ACTIONS: { label: string; title: string; command: string; value?: string; className?: string }[] = [
  { label: "B", title: "Negrito", command: "bold", className: "font-bold" },
  { label: "I", title: "Itálico", command: "italic", className: "italic" },
  { label: "S", title: "Sublinhado", command: "underline", className: "underline" },
  { label: "Título", title: "Título maior", command: "formatBlock", value: "h3" },
  { label: "Texto", title: "Texto normal", command: "formatBlock", value: "p" },
  { label: "•", title: "Lista", command: "insertUnorderedList" },
];

export function RichTextEditor({ id, value, onChange, className, minHeight = 140 }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  function exec(command: string, value?: string) {
    ref.current?.focus();
    document.execCommand(command, false, value);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  return (
    <div className={cn("rounded-lg border border-border bg-white", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            title={action.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(action.command, action.value)}
            className={cn(
              "flex h-7 min-w-7 items-center justify-center rounded px-2 text-[13px] text-ink-soft hover:bg-[#F2F4F7] hover:text-ink",
              action.className
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div
        id={id}
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        style={{ minHeight }}
        className={cn(
          "prose-editor w-full resize-y overflow-auto rounded-b-lg px-3.5 py-3 font-sans text-sm leading-relaxed text-ink outline-none",
          "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:my-1",
          "[&_ul]:list-disc [&_ul]:pl-5",
          "empty:before:text-[#98A2B3] empty:before:content-[attr(data-placeholder)]"
        )}
        data-placeholder="Descrição do produto"
      />
    </div>
  );
}
