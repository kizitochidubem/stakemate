<div align="center">
  <img src="src/app/icon.jpg" alt="Stakemate" width="120" />

  # Stakemate

  **The Chess Arena For Agents.**

  AI agents play chess in real time. Wager SUI on Sui testnet and watch the arena live.

  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

  Built for the **CLAY hackathon** (Code Like A Yeti) on Sui.
</div>

---

## What Stakemate is

Stakemate is a competitive chess arena where AI agents fight in real time and humans wager on who pulls off the checkmate. Matches finish in about 60 to 180 seconds. You watch every move, hear captures, and see the eval bar move.

Three things that set it apart:

1. **Agents actually play chess.** Each agent runs a server-side engine with a documented style (aggressive, defensive, chaotic, and more). ELO updates from real results.

2. **Wagers are real on-chain.** SUI locks in the `stakemate::escrow` Move package on **Sui testnet** (pari-mutuel payouts + a liquidity pool that subsidizes solo bets).

3. **Connect a Sui wallet** (Slush, Sui Wallet, or any `@mysten/dapp-kit`-compatible wallet) and you're ready to play and wager.

You can also play agents yourself at `/play`.

---

## Settlement rail

| Rail | Chain | Asset | Wallet | Status |
| --- | --- | --- | --- | --- |
| **Sui testnet** | Sui | SUI | Slush, Sui Wallet, and other dapp-kit wallets | Live |

### Sui testnet setup

1. Install [Slush](https://slush.app) or another Sui wallet extension.
2. Switch the wallet to **testnet**.
3. Fund it from the in-app faucet on `/wallet`, or [faucet.sui.io](https://faucet.sui.io).
4. Wagers route through the `stakemate::escrow` Move package when `NEXT_PUBLIC_SUI_ESCROW_PACKAGE_ID` and `NEXT_PUBLIC_SUI_ESCROW_REGISTRY_ID` are set; otherwise wagers go directly to the treasury address.

---

## How a match works

1. Pick two agents on `/arena` and click **Start Match**.
2. The server runs minimax chess with personality-driven move ordering. The browser polls for moves every 250 to 400 ms.
3. Before or during the match, place a wager on white or black in **SUI**. Funds lock in the on-chain escrow for that match.
4. When the game ends, the oracle settles on-chain. Winners **claim** from the arena or `/wallet` (stake + profit from the losing pool, or from the liquidity pool when solo).

Pari-mutuel math: winners split the losing side's pool pro-rata (minus a fee). See [`move/stakemate_escrow/sources/escrow.move`](move/stakemate_escrow/sources/escrow.move).

---

## The agents

Eight platform agents ship today: Vault, Warden, Blitz, Glacier, Cipher, Lofi, Aftermath, Buck. Each maps to a play style and ELO band.

---

## Architecture

```
Browser (Next.js)
  ├─ @mysten/dapp-kit → Sui wallet connect + balance
  ├─ Sui escrow PTBs (place_wager, claim_payout, ...)
  └─ Polls /api/match/[id]/move for live chess

Server (Vercel)
  ├─ Minimax engine + match state
  ├─ Upstash Redis (agents, users, archives)
  └─ Oracle API routes for Sui escrow settlement (/api/sui-escrow/*)

On-chain (Sui testnet)
  └─ stakemate::escrow Move package: Registry + Match + Wager objects
```

**Stack:** Next.js 16, React 19, TypeScript, chess.js, `@mysten/sui`, `@mysten/dapp-kit`, Sui Move escrow.

---

## Routes

| Route | Description |
| --- | --- |
| `/` | Landing |
| `/arena` | Live AI vs AI matches with wagering |
| `/play` | Human vs agent |
| `/tournament` | 8-agent bracket |
| `/spectate` | Browse live matches |
| `/leaderboard` | Rankings |
| `/wallet` | Sui balance, faucet, claims, send |
| `/docs` | User documentation |
| `/admin` | Operator dashboard (env-gated) |

---

## Local development

```bash
git clone <your-repo-url>
cd stakemate
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Move package (optional)

```bash
cd move/stakemate_escrow
sui move test
sui move build
sui client publish --gas-budget 200000000
```

Capture the published Package ID and the shared Registry object ID for `NEXT_PUBLIC_SUI_ESCROW_PACKAGE_ID` / `NEXT_PUBLIC_SUI_ESCROW_REGISTRY_ID`.

---

## Environment variables

```env
# Site
NEXT_PUBLIC_SITE_URL=https://your-domain.example

# Sui
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_TREASURY_ADDRESS=0x...
NEXT_PUBLIC_SUI_ESCROW_PACKAGE_ID=0x...
NEXT_PUBLIC_SUI_ESCROW_REGISTRY_ID=0x...
STAKEMATE_ORACLE_PRIVATE_KEY=

# Storage (production)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Admin
STAKEMATE_ADMIN_SECRET=
```

See `.env.example` for the full list.

---

## Contributing

MIT licensed.

## License

[MIT](LICENSE)
