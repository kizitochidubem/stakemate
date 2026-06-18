import { explorerTxUrl } from "@/lib/sui/network";

export interface ChainMeta {
  label: string;
  asset: string;
  assetDecimals: number;
  description: string;
  faucetUrl?: string;
  explorerName: string;
  explorerTxUrl: (digest: string) => string;
  wageringEnabled: boolean;
  /** Shown in wallet connect UI */
  walletHint: string;
}

export const SUI_CHAIN: ChainMeta = {
  label: "Sui Testnet",
  asset: "SUI",
  assetDecimals: 9,
  description:
    "SUI match pools on Sui testnet. Connect with Slush, Sui Wallet, or any dApp Kit compatible wallet.",
  faucetUrl: "https://faucet.sui.io",
  explorerName: "Sui Vision",
  explorerTxUrl,
  wageringEnabled: true,
  walletHint: "Sui wallet (Slush, Sui Wallet)",
};
