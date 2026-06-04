"use client";

import { useState, useCallback, createContext, useContext, useRef, useEffect } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    message: "",
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = useRef("confirm-dialog-title");

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    triggerRef.current = document.activeElement as HTMLElement;
    setOptions(opts);
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(true);
    triggerRef.current?.focus();
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(false);
    triggerRef.current?.focus();
  }, []);

  // Focus trap + ESC handler
  useEffect(() => {
    if (!open) return;

    // Focus the cancel button on open
    cancelBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
        return;
      }

      if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleCancel]);

  const btnColor =
    options.variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : options.variant === "warning"
        ? "bg-yellow-500 hover:bg-yellow-600 text-white"
        : "bg-primary hover:bg-primary-dark text-white";

  const iconConfig =
    options.variant === "danger"
      ? { bg: "bg-red-100", color: "text-red-600", Icon: AlertTriangle }
      : options.variant === "warning"
        ? { bg: "bg-yellow-100", color: "text-yellow-600", Icon: AlertTriangle }
        : { bg: "bg-primary-light", color: "text-primary", Icon: HelpCircle };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby={options.title ? titleId.current : undefined}
          aria-describedby="confirm-dialog-message"
          ref={dialogRef}
        >
          {/* Backdrop click to cancel */}
          <div className="absolute inset-0" onClick={handleCancel} aria-hidden="true" />
          <div className="bg-surface rounded-xl shadow-2xl border border-border max-w-lg w-full mx-4 p-8 relative z-10">
            <div className="flex items-start gap-5">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${iconConfig.bg}`}>
                <iconConfig.Icon className={`h-6 w-6 ${iconConfig.color}`} aria-hidden="true" />
              </div>
              <div className="flex-1">
                {options.title && (
                  <h3 id={titleId.current} className="text-xl font-bold text-txt-primary mb-2">
                    {options.title}
                  </h3>
                )}
                <p id="confirm-dialog-message" className="text-base text-txt-secondary leading-relaxed">{options.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center justify-center rounded-lg border border-border bg-surface-secondary px-6 py-3 text-base font-semibold text-txt-primary transition-all hover:bg-surface-tertiary"
              >
                {options.cancelText || "Batal"}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={handleConfirm}
                className={`inline-flex items-center justify-center rounded-lg px-6 py-3 text-base font-semibold transition-all ${btnColor}`}
              >
                {options.confirmText || "Ya, Lanjutkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
