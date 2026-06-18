import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

export function loadSuiKeypairFromEnv(
  primaryEnv: string,
  fallbackEnv?: string
): Ed25519Keypair | null {
  const secret =
    process.env[primaryEnv]?.trim() ||
    (fallbackEnv ? process.env[fallbackEnv]?.trim() : undefined);
  if (!secret) return null;

  let decoded: ReturnType<typeof decodeSuiPrivateKey>;
  try {
    decoded = decodeSuiPrivateKey(secret);
  } catch {
    throw new Error(`${primaryEnv} is invalid`);
  }

  if (decoded.scheme !== "ED25519") {
    throw new Error(`${primaryEnv} must be an Ed25519 private key (got ${decoded.scheme})`);
  }

  return Ed25519Keypair.fromSecretKey(decoded.secretKey);
}

/** The escrow oracle/admin keypair used to sign settle/cancel/ensure-match transactions. */
export function loadOracleKeypair(): Ed25519Keypair {
  const keypair = loadSuiKeypairFromEnv("STAKEMATE_ORACLE_PRIVATE_KEY");
  if (!keypair) {
    throw new Error("STAKEMATE_ORACLE_PRIVATE_KEY is not configured on the server");
  }
  return keypair;
}
