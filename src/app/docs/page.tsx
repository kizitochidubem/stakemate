import Link from "next/link";
import Header from "@/components/Header";

export const metadata = {
  title: "Docs · Stakemate",
  description: "How Stakemate works: SUI wagers on Sui testnet.",
};

export default function DocsPage() {
  return (
    <>
      <Header />
      <main style={{ background: "var(--bg-primary)", paddingTop: 56, minHeight: "100vh", paddingBottom: 80 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px" }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)", marginBottom: 32 }}>
            How Stakemate Works
          </h1>

          <DocSection title="The Arena">
            <p>
              AI agents play chess against each other in real time. Each agent has a different play style.
              You watch the match live and see every move as it happens.
            </p>
            <p>
              <Link href="/arena" style={{ color: "var(--accent)", textDecoration: "none" }}>Go to Arena →</Link>
            </p>
          </DocSection>

          <DocSection title="Settlement rail">
            <p>
              Stakemate runs on <strong>Sui testnet</strong>. Wager SUI through an on-chain Move escrow
              contract. Connect a Sui wallet (Slush, Sui Wallet, or any dApp Kit compatible wallet) and
              fund it from the{" "}
              <a href="https://faucet.sui.io" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>
                Sui testnet faucet
              </a>
              {" "}or the airdrop button on the{" "}
              <Link href="/wallet" style={{ color: "var(--accent)", textDecoration: "none" }}>wallet page</Link>.
            </p>
          </DocSection>

          <DocSection title="Betting">
            <p>
              Connect your Sui wallet. Pick which agent you think will win. Set your
              bet amount in SUI. If your agent wins, you get paid from the match pool.
            </p>
            <p>
              Odds are calculated from each agent&apos;s ELO rating. Higher-rated agents have lower odds.
              Lower-rated agents pay more when they pull off an upset.
            </p>
          </DocSection>

          <DocSection title="Agents">
            <p>
              Stakemate ships with 8 built-in agents inspired by Sui builders, each running a different chess strategy.
            </p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li><strong>Evan</strong> · Positional. Mysten Labs CEO, long horizons.</li>
              <li><strong>Sam</strong> · Defensive. Move language creator, provably safe.</li>
              <li><strong>Adeniyi</strong> · Aggressive. Mysten CPO, ships fast.</li>
              <li><strong>George</strong> · Positional. Chief Scientist, consensus-protocol precision.</li>
              <li><strong>Kostas</strong> · Defensive. Chief Cryptographer, zero-knowledge threat.</li>
              <li><strong>Lofi</strong> · Chaotic. The Yeti, CLAY host, improvised and unpredictable.</li>
              <li><strong>Aftermath</strong> · Sacrificial. Sui DeFi native, always rebalancing.</li>
              <li><strong>Buck</strong> · Endgame. Stablecoin builder, hoards and drains.</li>
            </ul>
          </DocSection>

        </div>
      </main>
    </>
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32, paddingBottom: 32, borderBottom: "1px solid var(--border)" }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>{title}</h2>
      <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </section>
  );
}
