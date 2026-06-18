import type { Agent } from "./agents";

export interface AgentVisual {
  /** Resolved image URL for next/image */
  portraitUrl: string;
  /** Optional on-chain NFT mint (metadata / explorer links) */
  nftMint?: string;
  source: "local" | "nft" | "generated";
}

const BOT_AVATAR = (seed: string) =>
  `https://api.dicebear.com/7.x/bottts-neutral/png?seed=${encodeURIComponent(seed)}&backgroundColor=030a1a`;

const AGENT_VISUALS: Record<string, { portraitUrl: string; source: AgentVisual["source"] }> = {
  vault:     { portraitUrl: BOT_AVATAR("vault"),     source: "generated" },
  warden:    { portraitUrl: BOT_AVATAR("warden"),    source: "generated" },
  blitz:     { portraitUrl: BOT_AVATAR("blitz"),     source: "generated" },
  glacier:   { portraitUrl: BOT_AVATAR("glacier"),   source: "generated" },
  cipher:    { portraitUrl: BOT_AVATAR("cipher"),    source: "generated" },
  lofi:      { portraitUrl: BOT_AVATAR("lofi"),      source: "generated" },
  aftermath: { portraitUrl: BOT_AVATAR("aftermath"), source: "generated" },
  buck:      { portraitUrl: BOT_AVATAR("buck"),      source: "generated" },
};

export function getAgentVisual(agent: Agent): AgentVisual {
  if (agent.avatarUrl) {
    return {
      portraitUrl: agent.avatarUrl,
      nftMint: agent.nftMint,
      source: agent.nftMint ? "nft" : "local",
    };
  }
  const base = AGENT_VISUALS[agent.id];
  if (base) {
    return { portraitUrl: base.portraitUrl, source: base.source };
  }
  return { portraitUrl: BOT_AVATAR(agent.id), source: "generated" };
}

/** Ordered fallbacks when the primary portrait fails to load in the browser. */
export function getPortraitFallbackChain(agent: Agent, visual: AgentVisual): string[] {
  const chain: string[] = [visual.portraitUrl, BOT_AVATAR(agent.id)];
  return [...new Set(chain)];
}
