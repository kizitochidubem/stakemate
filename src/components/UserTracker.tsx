"use client";

import { useEffect, useRef } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";

/**
 * Registers wallet visits server-side when a user connects.
 */
export default function UserTracker() {
  const account = useCurrentAccount();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    const wallet = account?.address;
    if (!wallet || wallet === lastTracked.current) return;
    lastTracked.current = wallet;

    void fetch("/api/users/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet }),
    }).catch(() => {
      /* non-blocking */
    });
  }, [account]);

  return null;
}

export async function trackWagerPlaced(payload: {
  wallet: string;
  signature: string;
  matchId: string;
  amount: number;
  side: "white" | "black";
  agentName: string;
}): Promise<void> {
  await fetch("/api/users/wager", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function trackWagerSettled(payload: {
  wallet: string;
  matchId: string;
  outcome: "won" | "lost" | "refund";
}): Promise<void> {
  await fetch("/api/users/settle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
