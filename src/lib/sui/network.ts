import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

export type SuiClient = SuiJsonRpcClient;

export type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

export const SUI_NETWORK: SuiNetwork =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as SuiNetwork | undefined) ?? "testnet";

const FULLNODE_URLS: Record<SuiNetwork, string> = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
  localnet: "http://127.0.0.1:9000",
};

export function getFullnodeUrl(network: SuiNetwork): string {
  return FULLNODE_URLS[network];
}

/** 1 SUI = 10^9 MIST */
export const MIST_PER_SUI = BigInt(1_000_000_000);

/** Treasury address that receives settlement fees */
export const TREASURY_WALLET = process.env.NEXT_PUBLIC_SUI_TREASURY_ADDRESS ?? "";

export function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_SUI_RPC_URL ?? getFullnodeUrl(SUI_NETWORK);
}

/** Server-side SuiClient pointed at the configured RPC endpoint. */
export function getSuiClient(): SuiClient {
  return new SuiJsonRpcClient({ url: getRpcUrl(), network: SUI_NETWORK });
}

/** 0x + 64 hex chars - the normalized Sui address format. */
export const SUI_ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;

export function isValidSuiAddress(address: string): boolean {
  return SUI_ADDRESS_RE.test(address);
}

export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

function explorerBase(): string {
  switch (SUI_NETWORK) {
    case "mainnet":
      return "https://suivision.xyz";
    case "devnet":
      return "https://devnet.suivision.xyz";
    case "localnet":
      return "https://custom.suivision.xyz";
    case "testnet":
    default:
      return "https://testnet.suivision.xyz";
  }
}

export function explorerTxUrl(digest: string): string {
  return `${explorerBase()}/txblock/${digest}`;
}

export function explorerAddressUrl(address: string): string {
  return `${explorerBase()}/account/${address}`;
}
