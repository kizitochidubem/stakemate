"use client";

import type { ReactNode } from "react";
import SuiProvider from "@/providers/SuiProvider";
import { ToastProvider } from "@/contexts/ToastContext";
import { WagerProvider } from "@/contexts/WagerContext";
import UserTracker from "@/components/UserTracker";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <SuiProvider>
      <ToastProvider>
        <WagerProvider>
          <UserTracker />
          {children}
        </WagerProvider>
      </ToastProvider>
    </SuiProvider>
  );
}
