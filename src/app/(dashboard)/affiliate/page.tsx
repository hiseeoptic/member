"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

interface AffiliateData {
  referralCode: string;
  referralLink: string;
  clicks: number;
  totalReferrals: number;
  activeReferrals: number;
  totalEarnings: number;
  pendingPayout: number;
  minPayout: number;
  usdtWallet: string | null;
  referrals: Array<{
    user: string;
    status: string;
    earned: number;
    joinedAt: string;
  }>;
  commissions: Array<{
    period: string;
    amount: number;
    sourceAmount: number;
    status: string;
    createdAt: string;
  }>;
  payouts: Array<{
    amount: number;
    usdtAmount: number;
    status: string;
    txHash: string | null;
    createdAt: string;
  }>;
}

export default function AffiliatePage() {
  const { status } = useSession();
  const [data, setData] = useState<AffiliateData | null>(null);
  const [copied, setCopied] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestMsg, setRequestMsg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") redirect("/login");
    if (status === "authenticated") {
      fetch("/api/affiliate/stats")
        .then((r) => r.json())
        .then(setData);
    }
  }, [status]);

  const copyLink = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const requestPayout = async () => {
    setRequesting(true);
    setRequestMsg("");
    const res = await fetch("/api/affiliate/request", { method: "POST" });
    const result = await res.json();
    setRequestMsg(result.message || result.error);
    setRequesting(false);
    if (res.ok) {
      // Refresh data
      const fresh = await fetch("/api/affiliate/stats").then((r) => r.json());
      setData(fresh);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-zinc-400 hover:text-white text-sm font-semibold">
            ← Dashboard
          </Link>
          <span className="text-white font-black">Affiliate Program</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Referral Link Card */}
        <div className="bg-gradient-to-r from-emerald-600/10 to-teal-600/10 border border-emerald-500/20 rounded-2xl p-6">
          <h2 className="text-xs font-black text-emerald-500 uppercase tracking-wider mb-3">Your Referral Link</h2>
          <div className="flex items-center gap-2 mb-3">
            <code className="flex-1 bg-zinc-900/80 text-emerald-400 px-4 py-3 rounded-xl font-mono text-sm truncate border border-emerald-500/10">
              {data.referralLink}
            </code>
            <button
              onClick={copyLink}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-colors shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>Code: <strong className="text-emerald-400">{data.referralCode}</strong></span>
            <span>•</span>
            <span>{data.clicks} clicks</span>
            <span>•</span>
            <span>20% recurring commission</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Referrals", value: data.totalReferrals, color: "text-indigo-400" },
            { label: "Active (Paying)", value: data.activeReferrals, color: "text-green-400" },
            { label: "Total Earned", value: `$${data.totalEarnings.toFixed(2)}`, color: "text-amber-400" },
            { label: "Available Payout", value: `$${data.pendingPayout.toFixed(2)}`, color: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-zinc-500 text-[11px] font-bold uppercase mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Payout Request */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-wider">Request Payout</h2>
              <p className="text-zinc-600 text-xs mt-1">
                Minimum: ${data.minPayout} USDT • Wallet: {data.usdtWallet ? `${data.usdtWallet.slice(0, 8)}...${data.usdtWallet.slice(-4)}` : "Not set"}
              </p>
            </div>
            <button
              onClick={requestPayout}
              disabled={requesting || data.pendingPayout < data.minPayout || !data.usdtWallet}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {requesting ? "Processing..." : `Withdraw $${data.pendingPayout.toFixed(2)}`}
            </button>
          </div>
          {requestMsg && (
            <div className={`text-sm font-semibold mt-2 ${requestMsg.includes("success") ? "text-green-400" : "text-red-400"}`}>
              {requestMsg}
            </div>
          )}
          {!data.usdtWallet && (
            <Link href="/billing" className="text-indigo-400 text-xs font-semibold hover:underline">
              → Set up your USDT wallet in Billing settings
            </Link>
          )}
        </div>

        {/* Referrals Table */}
        {data.referrals.length > 0 && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-4">Your Referrals</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-left text-xs">
                    <th className="pb-3 font-bold">User</th>
                    <th className="pb-3 font-bold">Status</th>
                    <th className="pb-3 font-bold">Earned</th>
                    <th className="pb-3 font-bold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.referrals.map((r, i) => (
                    <tr key={i}>
                      <td className="py-3 text-zinc-300">{r.user}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          r.status === "ACTIVE" ? "text-green-400 bg-green-500/10" :
                          r.status === "PENDING" ? "text-amber-400 bg-amber-500/10" :
                          "text-zinc-400 bg-zinc-500/10"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 text-emerald-400 font-bold">${r.earned.toFixed(2)}</td>
                      <td className="py-3 text-zinc-500">{new Date(r.joinedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Commission History */}
        {data.commissions.length > 0 && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-4">Commission History</h2>
            <div className="space-y-2">
              {data.commissions.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <span className="text-zinc-300 text-sm font-semibold">{c.period}</span>
                    <span className="text-zinc-600 text-xs ml-2">from ${c.sourceAmount.toFixed(2)} payment</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-bold text-sm">+${c.amount.toFixed(2)}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      c.status === "PAID" ? "text-green-400 bg-green-500/10" :
                      c.status === "APPROVED" ? "text-amber-400 bg-amber-500/10" :
                      "text-zinc-400 bg-zinc-500/10"
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payout History */}
        {data.payouts.length > 0 && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-4">Payout History</h2>
            <div className="space-y-2">
              {data.payouts.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <span className="text-zinc-300 text-sm font-semibold">${p.amount.toFixed(2)}</span>
                    <span className="text-zinc-600 text-xs ml-2">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.txHash && (
                      <a href={`https://tronscan.org/#/transaction/${p.txHash}`} target="_blank" className="text-indigo-400 text-xs hover:underline">
                        TxHash ↗
                      </a>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.status === "COMPLETED" ? "text-green-400 bg-green-500/10" :
                      p.status === "PROCESSING" ? "text-amber-400 bg-amber-500/10" :
                      p.status === "FAILED" ? "text-red-400 bg-red-500/10" :
                      "text-zinc-400 bg-zinc-500/10"
                    }`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
