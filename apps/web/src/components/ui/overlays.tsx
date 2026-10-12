"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

function useInitialFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => prev?.focus?.();
  }, [open]);
  return ref;
}

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

/** Right-side modal panel with red header and round white close button (§12.3 "Modal samping"). */
export function SidePanel({ open, onClose, title, children, footer, width = "sm:max-w-[540px]" }: SidePanelProps) {
  const titleId = useId();
  useEscape(open, onClose);
  const ref = useInitialFocus(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex justify-end">
      <div className="absolute inset-0 bg-black/40" aria-hidden onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn("relative flex h-full w-full flex-col bg-white shadow-panel outline-none", width)}
      >
        <header className="flex h-[60px] shrink-0 items-center justify-between bg-primary px-5">
          <h2 id={titleId} className="text-base font-medium text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-8 place-items-center rounded-full bg-white text-ink hover:bg-primary-soft"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="shrink-0 border-t border-divider px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const titleId = useId();
  useEscape(open, onClose);
  const ref = useInitialFocus(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-lg bg-white shadow-panel outline-none"
      >
        <header className="flex items-center justify-between border-b border-divider px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-8 place-items-center rounded-full text-muted-strong hover:bg-row-alt"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-divider px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}
