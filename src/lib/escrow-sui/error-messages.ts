/**
 * Map Sui Move abort codes (from `stakemate::escrow`) and wallet/RPC noise
 * to user-facing copy.
 */

// Mirrors the `E*` constants in move/stakemate_escrow/sources/escrow.move
const ABORT_MESSAGES: Record<number, string> = {
  0: "Fee is too high for this match.", // EFeeTooHigh
  1: "Amount must be greater than zero.", // EZeroAmount
  2: "This match is already settled on-chain. Tap “Claim refund” · no need to settle again.", // EMatchClosed
  3: "The match is not settled yet. Wait a moment and try again, or use “Refund stake” if the game was interrupted.", // ENotSettled
  4: "Only the match oracle can do that.", // EUnauthorized
  5: "You already claimed this wager. Your SUI should be in your wallet.", // EAlreadyClaimed
  6: "Invalid oracle address.", // EInvalidOracle
  7: "Odds must be at least 1.00x.", // EInvalidOdds
  8: "A match with this id already exists on-chain.", // EMatchExists
  9: "You already have a wager on this match. We rotated to a fresh slot · try again.", // EWagerExists
  10: "Invalid side - pick white or black.", // EInvalidSide
  11: "Invalid outcome - must be draw, white, or black.", // EInvalidOutcome
};

const GENERIC_PATTERNS: { test: RegExp; message: string }[] = [
  {
    test: /Rejected from user|User rejected|rejected the request/i,
    message: "Transaction cancelled in your wallet.",
  },
  {
    test: /InsufficientGas|insufficient funds|No valid gas coins|not enough (?:SUI|coins)/i,
    message: "Not enough SUI in your wallet to pay the network fee.",
  },
  {
    test: /timed out|TimeoutError|deadline exceeded/i,
    message: "Network timed out. Please try again.",
  },
];

/** Extract the abort code from a Sui `MoveAbort(..., <code>) in command <n>` error string. */
function abortCode(raw: string): number | null {
  const match = raw.match(/MoveAbort\([^)]*\),\s*(\d+)\)/) ?? raw.match(/abort code[:]?\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function friendlyEscrowError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Something went wrong";

  const code = abortCode(raw);
  if (code != null && code in ABORT_MESSAGES) {
    return ABORT_MESSAGES[code];
  }

  for (const { test, message } of GENERIC_PATTERNS) {
    if (test.test(raw)) return message;
  }

  if (raw.length > 160) {
    return "Transaction failed. Try again or open Sui Vision for details.";
  }

  return raw;
}
