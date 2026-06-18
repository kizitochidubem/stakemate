"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import LeaderboardView from "@/components/LeaderboardView";
import type { Agent } from "@/lib/agents";
import { fetchAgentRoster } from "@/lib/agents-client";

const POLL_INTERVAL_MS = 20_000;

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(initial: boolean) {
      try {
        const roster = await fetchAgentRoster();
        if (!cancelled) {
          setAgents([...roster].sort((a, b) => b.elo - a.elo));
          if (initial) setLoading(false);
        }
      } catch {
        if (!cancelled && initial) {
          setError("Could not load leaderboard");
          setLoading(false);
        }
      }
    }

    void load(true);
    const id = setInterval(() => { void load(false); }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <Header />
      <LeaderboardView agents={agents} loading={loading} error={error} />
    </>
  );
}
