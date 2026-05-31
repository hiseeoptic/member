"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

const USDT_WALLET = "TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; // Your receiving wallet
const PLANS_USDT: Record<string, { label: string; price: number }> = {
  MONTHLY: { label: "Pro Monthly", price: 19.99 },
  YEARLY: { label: "Pro Yearly", price: 149.99 },
};

export default function BillingPage() {
  const { status } = useSession();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [wallet, setWallet] = useState("");
  const [walletSaved, setWalletSaved] = useState(false);
  const [usdtPlan, setUsdtPlan] = useState("MONTHLY");
  const [txHash, setTxHash] = useState("");
  const [usdtSubmitted, setUsdtSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") redirect("/login");
    if (status === "authenticated") {
      fetch("/api/user/me")
        .then((r) => r.json())
        .then((data) => {
          setProfile(data);
          if (data.usdtWallet) setWallet(data.usdtWallet);
        });
    }
  }, [status]);

  const handleSaveWallet = async () => {
    setLoading(true);
    const res = await fetch("/api/user/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: wallet }),
    });
    if (res.ok) {
      setWalletSaved(true);
      setTimeout(() => setWalletSaved(false), 3000);
    }
    setLoading(false);
  };

  const handleCheckout = async (plan: string) => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  };

  const handleUsdtPayment = async () => {
    if (!txHash.trim()) return;
    setLoading(true);
    const res = await fetch("/api/payment/usdt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: usdtPlan,
        txHash: txHash.trim(),
        amount: PLANS_USDT[usdtPlan].price,
      }),
    });
    if (res.ok) {
      setUsdtSubmitted(true);
    }
    setLoading(false);
  };

  const openPortal = async () => {
    const res = await fetch("/api/portal", { method: "POST" });
    const { url, error } = await res.json();
    if (url) window.location.href = url;
    else if (error) alert(error);
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-500">Loading...</div>
      </div>
    );
  }

  const sub = profile.subscription as Record<string, unknown> | null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      {/* Header */}
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-zinc-400 hover:text-white text-sm font-semibold">
              ← Dashboard
            </Link>
          </div>
          <span className="text-white font-black">Billing & Settings</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Current Plan */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-4">Current Plan</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-bold text-lg">
                {sub?.status === "ACTIVE"
                  ? `Pro ${sub?.plan === "YEARLY" ? "Yearly" : "Monthly"}`
                  : sub?.status === "TRIAL"
                  ? "Free Trial"
                  : String(sub?.status || "None")}
              </div>
              <div className="text-zinc-500 text-sm mt-1">
                {sub?.status === "TRIAL" && sub?.trialEndsAt
                  ? `Trial ends: ${new Date(sub.trialEndsAt as string).toLocaleDateString()}`
                  : sub?.currentPeriodEnd
                  ? `Renews: ${new Date(sub.currentPeriodEnd as string).toLocaleDateString()}`
                  : ""}
              </div>
              <div className="text-zinc-600 text-xs mt-1">
                Payment: {String(sub?.paymentMethod || "—")}
              </div>
            </div>
            <div
              className={`px-4 py-2 rounded-xl text-sm font-bold ${
                sub?.status === "ACTIVE"
                  ? "text-green-400 bg-green-500/10 border border-green-500/20"
                  : sub?.status === "TRIAL"
                  ? "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                  : "text-zinc-400 bg-zinc-500/10 border border-zinc-500/20"
              }`}
            >
              {String(sub?.status || "NONE")}
            </div>
          </div>
          {sub?.paymentMethod === "STRIPE" && sub?.status === "ACTIVE" && (
            <button
              onClick={openPortal}
              className="mt-4 text-indigo-400 hover:text-indigo-300 text-xs font-semibold hover:underline"
            >
              Manage Subscription (Stripe Portal) →
            </button>
          )}
        </div>

        {/* Stripe Payment */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-4">
            💳 Pay with Card (Stripe)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleCheckout("MONTHLY")}
              className="p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-xl hover:border-indigo-500/40 transition-colors text-left"
            >
              <div className="text-white font-bold">Monthly</div>
              <div className="text-indigo-400 font-black text-2xl mt-1">$19.99</div>
              <div className="text-zinc-500 text-xs mt-1">per month</div>
            </button>
            <button
              onClick={() => handleCheckout("YEARLY")}
              className="p-4 bg-purple-600/10 border border-purple-500/20 rounded-xl hover:border-purple-500/40 transition-colors text-left relative"
            >
              <div className="absolute -top-2 right-3 bg-purple-600 text-white text-[10px] font-black px-3 py-0.5 rounded-full">
                SAVE 37%
              </div>
              <div className="text-white font-bold">Yearly</div>
              <div className="text-purple-400 font-black text-2xl mt-1">$149.99</div>
              <div className="text-zinc-500 text-xs mt-1">per year</div>
            </button>
          </div>
        </div>

        {/* USDT Payment */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-4">
            🪙 Pay with USDT (TRC-20)
          </h2>

          {usdtSubmitted ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
              <div className="text-green-400 font-bold text-lg mb-1">✅ Payment Submitted!</div>
              <p className="text-zinc-400 text-sm">
                Your subscription has been activated. Refresh the page to see updated status.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {/* Step 1: Choose plan */}
                <div>
                  <label className="text-zinc-400 text-xs font-bold block mb-2">1. Choose Plan</label>
                  <div className="flex gap-3">
                    {Object.entries(PLANS_USDT).map(([key, plan]) => (
                      <button
                        key={key}
                        onClick={() => setUsdtPlan(key)}
                        className={`flex-1 p-3 rounded-xl text-sm font-bold border transition-colors ${
                          usdtPlan === key
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : "border-white/10 text-zinc-400 hover:border-white/20"
                        }`}
                      >
                        {plan.label} — ${plan.price}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Send USDT */}
                <div>
                  <label className="text-zinc-400 text-xs font-bold block mb-2">
                    2. Send ${PLANS_USDT[usdtPlan].price} USDT (TRC-20) to:
                  </label>
                  <div className="bg-zinc-800 border border-white/5 rounded-xl p-3 font-mono text-sm text-emerald-400 break-all select-all">
                    {USDT_WALLET}
                  </div>
                  <p className="text-zinc-600 text-[11px] mt-1">
                    Network: TRON (TRC-20) only. Do NOT send on other networks.
                  </p>
                </div>

                {/* Step 3: Submit txHash */}
                <div>
                  <label className="text-zinc-400 text-xs font-bold block mb-2">
                    3. Paste Transaction Hash
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder="TxHash from TronScan..."
                      className="flex-1 bg-zinc-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:border-emerald-500/40 focus:outline-none"
                    />
                    <button
                      onClick={handleUsdtPayment}
                      disabled={!txHash.trim() || loading}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      {loading ? "..." : "Submit"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* USDT Wallet (for affiliate payouts) */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-1">
            💰 Affiliate Payout Wallet
          </h2>
          <p className="text-zinc-500 text-xs mb-4">
            Enter your TRC-20 USDT wallet address to receive affiliate commissions.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="TRC-20 address (starts with T...)"
              className="flex-1 bg-zinc-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:border-indigo-500/40 focus:outline-none"
            />
            <button
              onClick={handleSaveWallet}
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
            >
              {walletSaved ? "Saved ✅" : loading ? "..." : "Save"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
