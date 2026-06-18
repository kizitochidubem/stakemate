"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";

export function useSettlementWallet(): {
  address: string | null;
  connected: boolean;
} {
  const account = useCurrentAccount();

  return {
    address: account?.address ?? null,
    connected: account !== null,
  };
}
