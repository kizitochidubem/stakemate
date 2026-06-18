"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider, createNetworkConfig } from "@mysten/dapp-kit";
import type { ReactNode } from "react";
import { SUI_NETWORK, getFullnodeUrl } from "@/lib/sui/network";

import "@mysten/dapp-kit/dist/index.css";

const { networkConfig } = createNetworkConfig({
  mainnet: { network: "mainnet", url: getFullnodeUrl("mainnet") },
  testnet: { network: "testnet", url: getFullnodeUrl("testnet") },
  devnet: { network: "devnet", url: getFullnodeUrl("devnet") },
  localnet: { network: "localnet", url: getFullnodeUrl("localnet") },
});

const queryClient = new QueryClient();

export default function SuiProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={SUI_NETWORK}>
        <WalletProvider autoConnect storageKey="stakemate:sui-wallet">
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
