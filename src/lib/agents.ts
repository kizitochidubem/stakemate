export type Personality =
  | "aggressive"
  | "defensive"
  | "chaotic"
  | "positional"
  | "sacrificial"
  | "endgame";

/** Static identity · no match record (loaded from agent-stats). */
export interface AgentProfile {
  id: string;
  name: string;
  style: string;
  lore: string;
  sigil: string;
  depth: number;
  personality: Personality;
  /** Initial ELO when the agent has zero recorded games */
  baseElo: number;
  /** X handle for attribution (no @) */
  xHandle?: string;
}

export interface Agent {
  id: string;
  name: string;
  elo: number;
  style: string;
  lore: string;
  sigil: string;
  wins: number;
  losses: number;
  draws: number;
  depth: number;
  personality: Personality;
  recentResults: ("W" | "L" | "D")[];
  xHandle?: string;
  /** Custom / NFT agents · overrides default portrait */
  avatarUrl?: string;
  nftMint?: string;
}

export const AGENT_PROFILES: AgentProfile[] = [
  {
    id: "vault",
    name: "Vault",
    baseElo: 2410,
    style: "POSITIONAL",
    lore: "Builds a position like a fortress treasury: nothing leaves, nothing breaks.",
    sigil: "V",
    depth: 7,
    personality: "positional",
  },
  {
    id: "warden",
    name: "Warden",
    baseElo: 2390,
    style: "DEFENSIVE",
    lore: "Every position must be airtight before advancing. Paranoid, exhaustive, allergic to risk.",
    sigil: "W",
    depth: 6,
    personality: "defensive",
  },
  {
    id: "blitz",
    name: "Blitz",
    baseElo: 2320,
    style: "AGGRESSIVE",
    lore: "Takes space immediately and dares you to find the refutation.",
    sigil: "B",
    depth: 5,
    personality: "aggressive",
  },
  {
    id: "glacier",
    name: "Glacier",
    baseElo: 2460,
    style: "POSITIONAL",
    lore: "Methodical and fault-tolerant. Grinds you down one inevitable move at a time.",
    sigil: "G",
    depth: 7,
    personality: "positional",
  },
  {
    id: "cipher",
    name: "Cipher",
    baseElo: 2370,
    style: "DEFENSIVE",
    lore: "You don't see the threat until it's already too late. Quiet until it isn't.",
    sigil: "C",
    depth: 6,
    personality: "defensive",
  },
  {
    id: "lofi",
    name: "Lofi",
    baseElo: 1980,
    style: "CHAOTIC",
    lore: "The Yeti. CLAY hackathon host. Codes like jazz — improvised, unpredictable, somehow always on time.",
    sigil: "L",
    depth: 3,
    personality: "chaotic",
  },
  {
    id: "aftermath",
    name: "Aftermath",
    baseElo: 2200,
    style: "SACRIFICIAL",
    lore: "Sui DeFi native. Sacrifices material for liquidity. Plays like an AMM: always rebalancing, never out of position.",
    sigil: "F",
    depth: 5,
    personality: "sacrificial",
  },
  {
    id: "buck",
    name: "Buck",
    baseElo: 2150,
    style: "ENDGAME",
    lore: "Stablecoin builder on Sui. Hoards resources, ignores the opening, then drains you in the endgame.",
    sigil: "B",
    depth: 5,
    personality: "endgame",
  },
];

export const LEGACY_AGENT_ID_ALIASES: Record<string, string> = {
  evan: "vault",
  sam: "warden",
  adeniyi: "blitz",
  george: "glacier",
  kostas: "cipher",
};

export function resolveAgentId(id: string): string {
  return LEGACY_AGENT_ID_ALIASES[id] ?? id;
}

export const PLATFORM_AGENTS: Agent[] = AGENT_PROFILES.map((p) => ({
  ...p,
  elo: p.baseElo,
  wins: 0,
  losses: 0,
  draws: 0,
  recentResults: [],
}));

export function getAgentById(id: string): Agent | undefined {
  const resolved = resolveAgentId(id);
  return PLATFORM_AGENTS.find((a) => a.id === resolved);
}

export function getWinRate(agent: Pick<Agent, "wins" | "losses" | "draws">): number {
  const total = agent.wins + agent.losses + agent.draws;
  if (total === 0) return 0;
  return Math.round((agent.wins / total) * 100);
}
