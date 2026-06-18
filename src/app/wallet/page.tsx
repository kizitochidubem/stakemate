"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ConnectModal,
  useCurrentAccount,
  useDisconnectWallet,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { getFaucetHost, requestSuiFromFaucetV2 } from "@mysten/sui/faucet";
import Header from "@/components/Header";
import Spinner from "@/components/Spinner";
import {
  MIST_PER_SUI,
  SUI_NETWORK,
  explorerAddressUrl,
  explorerTxUrl,
  isValidSuiAddress,
  truncateAddress,
} from "@/lib/sui/network";
import { useToast } from "@/contexts/ToastContext";
import StakemateProfileCard from "@/components/StakemateProfileCard";
import PendingClaimsCard from "@/components/PendingClaimsCard";

export default function WalletPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { push } = useToast();

  const [open, setOpen] = useState(false);
  const [suiPrice, setSuiPrice] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [airdropping, setAirdropping] = useState(false);

  const { data: balanceData, refetch: refetchBalance } = useSuiClientQuery(
    "getBalance",
    { owner: account?.address ?? "" },
    { enabled: !!account, refetchInterval: 15_000 }
  );

  const { data: txData, isLoading: loadingHistory } = useSuiClientQuery(
    "queryTransactionBlocks",
    {
      filter: { FromAddress: account?.address ?? "" },
      options: { showEffects: true },
      limit: 10,
      order: "descending",
    },
    { enabled: !!account }
  );

  // Load SUI/USD price from CoinGecko
  useEffect(() => {
    let cancelled = false;
    const loadPrice = async () => {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd",
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.sui?.usd) setSuiPrice(data.sui.usd);
      } catch {
        /* ignore · show price as N/A */
      }
    };
    void loadPrice();
    const id = setInterval(() => void loadPrice(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const handleCopy = () => {
    if (!account) return;
    void navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAirdrop = async () => {
    if (!account || airdropping) return;
    setAirdropping(true);
    try {
      const res = await requestSuiFromFaucetV2({
        host: getFaucetHost("testnet"),
        recipient: account.address,
      });
      if (res.status !== "Success") {
        throw new Error("Faucet request failed");
      }
      push("1 SUI airdropped (testnet)", "success");
      void refetchBalance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Airdrop failed";
      push(/429|rate/i.test(msg) ? "Airdrop rate-limited, try again later" : `Airdrop failed: ${msg}`, "error");
    } finally {
      setAirdropping(false);
    }
  };

  const handleSend = async () => {
    if (!account) {
      push("Connect your wallet first", "error");
      return;
    }
    const to = sendTo.trim();
    if (!to || !sendAmount.trim()) {
      push("Enter a recipient and amount", "error");
      return;
    }
    if (!isValidSuiAddress(to)) {
      push("Invalid recipient address", "error");
      return;
    }

    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      push("Invalid amount", "error");
      return;
    }

    setSending(true);
    try {
      const mist = BigInt(Math.round(amount * Number(MIST_PER_SUI)));
      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(mist)]);
      tx.transferObjects([coin], tx.pure.address(to));
      tx.setSender(account.address);

      const result = await signAndExecuteTransaction({ transaction: tx });
      await client.waitForTransaction({ digest: result.digest });

      push(`Sent ${amount} SUI`, "success");
      setSendTo("");
      setSendAmount("");
      void refetchBalance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transfer failed";
      push(/rejected|denied|cancel/i.test(msg) ? "Cancelled" : `Failed: ${msg}`, "error");
    } finally {
      setSending(false);
    }
  };

  const cx: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "0 24px" };

  if (!account) {
    return (
      <>
        <Header />
        <main style={{ background: "var(--bg-primary)", paddingTop: 56, minHeight: "100vh" }}>
          <div style={{ ...cx, paddingTop: 96, textAlign: "center" }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
              Wallet
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
              Connect a Sui wallet to view your balance and recent transactions.
            </p>
            <ConnectModal
              trigger={
                <button
                  type="button"
                  style={{
                    padding: "12px 28px", fontSize: 14, fontWeight: 600, borderRadius: 8,
                    background: "var(--accent)", color: "var(--bg-primary)", border: "none", cursor: "pointer",
                  }}
                >
                  Connect Wallet
                </button>
              }
              open={open}
              onOpenChange={setOpen}
            />
          </div>
        </main>
      </>
    );
  }

  const networkLabel = SUI_NETWORK === "testnet" ? "Testnet" : SUI_NETWORK === "devnet" ? "Devnet" : SUI_NETWORK === "localnet" ? "Localnet" : "Mainnet";
  const address = account.address;
  const balance = balanceData ? Number(balanceData.totalBalance) / Number(MIST_PER_SUI) : null;
  const history = txData?.data ?? [];

  return (
    <>
      <Header />
      <main style={{ background: "var(--bg-primary)", paddingTop: 56, minHeight: "100vh" }}>
        <div style={{ ...cx, paddingTop: 32, paddingBottom: 48 }}>
          {/* Balance card */}
          <div style={{
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            borderRadius: 16, padding: 28, marginBottom: 20,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse 60% 80% at 80% 50%, rgba(77, 162, 255, 0.07) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 8 }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
                  color: "var(--text-muted)", textTransform: "uppercase",
                }}>
                  Balance · {networkLabel}
                </span>
                <button onClick={() => disconnect()} style={{
                  fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)",
                  background: "var(--bg-tertiary)", border: "1px solid var(--border)",
                  borderRadius: 6, padding: "4px 10px", cursor: "pointer",
                }}>
                  Disconnect
                </button>
              </div>

              <div style={{
                fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 800,
                color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.02em",
              }}>
                {balance !== null ? balance.toFixed(4) : "-"} <span style={{ fontSize: 22, color: "var(--text-muted)", fontWeight: 600 }}>SUI</span>
              </div>
              {balance !== null && suiPrice !== null && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-secondary)" }}>
                  ≈ ${(balance * suiPrice).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} USD
                  <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                    @ ${suiPrice.toFixed(2)}/SUI
                  </span>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
                  {truncateAddress(address, 6)}
                </span>
                <button onClick={handleCopy} style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, color: copied ? "var(--accent)" : "var(--text-muted)",
                  background: "none", border: "none", cursor: "pointer", padding: 4, textTransform: "uppercase", letterSpacing: "0.1em",
                }}>
                  {copied ? "✓ Copied" : "Copy"}
                </button>
                <a
                  href={explorerAddressUrl(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)",
                    textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.1em",
                  }}
                >
                  Explorer ↗
                </a>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <StakemateProfileCard wallet={address} />
          </div>

          {/* Claims sit above deployed agents so winnings are the first
              actionable thing a user sees after their balance. */}
          <div style={{ marginBottom: 20 }}>
            <PendingClaimsCard wallet={address} />
          </div>

          {/* Send / Receive grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
            {/* Send */}
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>
                Send SUI
              </h3>
              <input
                type="text"
                placeholder="Recipient address (0x...)"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", marginBottom: 8,
                  background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6,
                  fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)", outline: "none",
                }}
              />
              <input
                type="number"
                placeholder="Amount"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                step="0.01"
                min="0"
                style={{
                  width: "100%", padding: "10px 12px", marginBottom: 12,
                  background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6,
                  fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)", outline: "none",
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 6,
                  background: sending ? "var(--bg-tertiary)" : "var(--accent)",
                  color: sending ? "var(--text-muted)" : "var(--bg-primary)",
                  border: "none", cursor: sending ? "not-allowed" : "pointer",
                  fontSize: 13, fontWeight: 600,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {sending && <Spinner size={14} color="var(--text-muted)" />}
                {sending ? "Sending..." : "Send"}
              </button>
            </div>

            {/* Receive */}
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>
                Receive SUI
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
                Share your address to receive SUI. Make sure the sender is on {networkLabel.toLowerCase()}.
              </p>
              <div style={{
                padding: 12, background: "var(--bg-tertiary)", border: "1px solid var(--border)",
                borderRadius: 6, marginBottom: 12, wordBreak: "break-all",
                fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)",
              }}>
                {address}
              </div>
              <button
                onClick={handleCopy}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 6,
                  background: "var(--bg-tertiary)", color: "var(--text-primary)",
                  border: "1px solid var(--border)", cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                  marginBottom: SUI_NETWORK === "testnet" ? 8 : 0,
                }}
              >
                {copied ? "✓ Copied to clipboard" : "Copy Address"}
              </button>
              {SUI_NETWORK === "testnet" && (
                <button
                  onClick={handleAirdrop}
                  disabled={airdropping}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 6,
                    background: "transparent",
                    color: "var(--accent)",
                    border: "1px dashed var(--accent-dim)",
                    cursor: airdropping ? "not-allowed" : "pointer",
                    fontSize: 12, fontWeight: 600,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {airdropping && <Spinner size={12} color="var(--accent)" />}
                  {airdropping ? "Requesting..." : "Airdrop 1 SUI (testnet)"}
                </button>
              )}
            </div>
          </div>

          {/* Recent transactions */}
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                Recent Transactions
              </h3>
            </div>
            {loadingHistory ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Loading...
              </div>
            ) : history.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No transactions yet.
              </div>
            ) : (
              history.map((tx, i) => {
                const failed = tx.effects?.status?.status === "failure";
                return (
                  <a
                    key={tx.digest}
                    href={explorerTxUrl(tx.digest)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 20px",
                      borderBottom: i < history.length - 1 ? "1px solid var(--border)" : "none",
                      textDecoration: "none", color: "inherit",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tx.digest.slice(0, 12)}...{tx.digest.slice(-8)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        {tx.timestampMs ? new Date(Number(tx.timestampMs)).toLocaleString() : "Unknown time"}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, padding: "3px 8px", borderRadius: 4,
                      background: failed ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)",
                      color: failed ? "var(--danger)" : "var(--success)",
                      fontFamily: "var(--font-mono)", letterSpacing: "0.05em",
                    }}>
                      {failed ? "FAIL" : "OK"}
                    </span>
                  </a>
                );
              })
            )}
          </div>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <Link href="/arena" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>
              Back to Arena →
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
