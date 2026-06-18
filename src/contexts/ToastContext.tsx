"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface Toast {
  id: string;
  message: string;
  tone?: "default" | "success" | "error" | "info";
}

interface ToastContextValue {
  toasts: Toast[];
  push: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message: string, tone: Toast["tone"] = "default") => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="md:bottom-6"
      style={{
        position: "fixed",
        bottom: 64,
        right: 16,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 384,
        width: "100%",
        pointerEvents: "none",
      }}
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-slide-up"
          style={{
            pointerEvents: "auto",
            padding: 12,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            background: "var(--bg-secondary)",
            border: `1px solid ${
              toast.tone === "success"
                ? "var(--accent)"
                : toast.tone === "error"
                  ? "var(--danger)"
                  : "var(--border)"
            }`,
            borderRadius: 8,
          }}
        >
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)" }}>
            {toast.message}
          </p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              flexShrink: 0,
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
