"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string;
  subscription: {
    status: string;
    plan: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  };
  licenseKey: string | null;
  referralCode: string | null;
  referralLink: string | null;
  usdtWallet: string | null;
  role: string;
  affiliate: {
    totalReferrals: number;
    activeReferrals: number;
    totalEarnings: number;
    pendingPayout: number;
    referrals: Array<{
      user: string;
      status: string;
      earned: number;
      joinedAt: string;
    }>;
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") redirect("/login");
    if (status === "authenticated") {
      // Track referral (from cookie set by /ref/[code])
      fetch("/api/referral/track", { method: "POST" }).catch(() => {});

      fetch("/api/user/me")
        .then(async (r) => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error(body.detail || body.error || `HTTP ${r.status}`);
          }
          return r.json();
        })
        .then(setProfile)
        .catch((e) => setError(e.message || "Failed to load profile"));
    }
  }, [status]);

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-red-400 font-medium">Không tải được hồ sơ</div>
        <div className="text-zinc-500 text-sm max-w-md break-words">{error}</div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm hover:bg-zinc-700"
        >
          Đăng xuất & thử lại
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-500">Loading...</div>
      </div>
    );
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const daysLeft = profile.subscription.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(profile.subscription.trialEndsAt).getTime() - Date.now()) / 86400000))
    : profile.subscription.currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(profile.subscription.currentPeriodEnd).getTime() - Date.now()) / 86400000))
    : 0;

  const statusColor: Record<string, string> = {
    TRIAL: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    ACTIVE: "text-green-400 bg-green-500/10 border-green-500/20",
    PAST_DUE: "text-red-400 bg-red-500/10 border-red-500/20",
    EXPIRED: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    CANCELLED: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      {/* Header */}
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-sm">
              AF
            </div>
            <span className="font-black text-white tracking-tight">Auto Flow Pro</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/tokens" className="text-purple-400 hover:text-purple-300 text-xs font-semibold transition-colors">
              Credits
            </Link>
            <Link href="/affiliate" className="text-zinc-400 hover:text-white text-xs font-semibold transition-colors">
              Affiliate
            </Link>
            <Link href="/billing" className="text-zinc-400 hover:text-white text-xs font-semibold transition-colors">
              Billing
            </Link>
            {profile.role === "ADMIN" && (
              <Link href="/admin" className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors">
                Admin
              </Link>
            )}
            <button onClick={() => signOut({ callbackUrl: "/" })} className="text-zinc-500 hover:text-white text-xs font-semibold transition-colors">
              Logout
            </button>
            {profile.image && (
              <img src={profile.image} alt="" className="w-8 h-8 rounded-full" />
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Welcome + Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">
              Welcome, {profile.name?.split(" ")[0]}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Manage your subscription & affiliate program</p>
          </div>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold ${statusColor[profile.subscription.status] || statusColor.EXPIRED}`}>
            <div className={`w-2 h-2 rounded-full ${profile.subscription.status === "ACTIVE" ? "bg-green-500 animate-pulse" : profile.subscription.status === "TRIAL" ? "bg-amber-500 animate-pulse" : "bg-zinc-500"}`} />
            {profile.subscription.status}
            {daysLeft > 0 && ` — ${daysLeft} days left`}
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* License Key */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">License Key</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-zinc-800 text-indigo-400 px-3 py-2 rounded-lg font-mono text-sm truncate">
                {profile.licenseKey || "Generating..."}
              </code>
              <button
                onClick={() => profile.licenseKey && copyToClipboard(profile.licenseKey, "license")}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-colors"
              >
                {copied === "license" ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-zinc-600 text-xs mt-2">Paste this into your Chrome extension settings</p>
          </div>

          {/* Referral Link */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">Referral Link</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-zinc-800 text-emerald-400 px-3 py-2 rounded-lg font-mono text-sm truncate">
                {profile.referralLink || "Generating..."}
              </code>
              <button
                onClick={() => profile.referralLink && copyToClipboard(profile.referralLink, "referral")}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-colors"
              >
                {copied === "referral" ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-zinc-600 text-xs mt-2">Share to earn 20% recurring commission</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Referrals", value: profile.affiliate.totalReferrals, color: "text-indigo-400" },
            { label: "Active", value: profile.affiliate.activeReferrals, color: "text-green-400" },
            { label: "Earned", value: `$${profile.affiliate.totalEarnings.toFixed(2)}`, color: "text-amber-400" },
            { label: "Pending", value: `$${profile.affiliate.pendingPayout.toFixed(2)}`, color: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-zinc-500 text-[11px] font-bold uppercase mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Upgrade CTA (show for trial/expired users) */}
        {(profile.subscription.status === "TRIAL" || profile.subscription.status === "EXPIRED") && (
          <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 rounded-2xl p-6">
            <h3 className="text-white font-black text-lg mb-2">Upgrade to Pro</h3>
            <p className="text-zinc-400 text-sm mb-4">Unlimited access to all features</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleCheckout("MONTHLY")}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-colors"
              >
                Monthly — $19.99/mo
              </button>
              <button
                onClick={() => handleCheckout("YEARLY")}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm transition-colors"
              >
                Yearly — $149.99/yr (Save 37%)
              </button>
            </div>
          </div>
        )}

        {/* Referral Table */}
        {profile.affiliate.referrals.length > 0 && (
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-4">Your Referrals</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-left">
                    <th className="pb-3 font-bold">User</th>
                    <th className="pb-3 font-bold">Status</th>
                    <th className="pb-3 font-bold">Earned</th>
                    <th className="pb-3 font-bold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {profile.affiliate.referrals.map((r, i) => (
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
      </main>
    </div>
  );
}
