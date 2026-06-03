"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  trialUsers: number;
  expiredUsers: number;
  recentSignups: number;
  totalReferrals: number;
  activeReferrals: number;
  pendingPayouts: number;
  // Financials
  grossRevenue: number;
  paidCustomers: number;
  pendingPayments: number;
  commissionsOwed: number;
  commissionsPaid: number;
  totalPaidOut: number;
  netRevenue: number;
}

interface AffiliateRow {
  userId: string;
  name: string | null;
  email: string | null;
  code: string;
  clicks: number;
  wallet: string | null;
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: number;
  pendingPayout: number;
  paidOut: number;
  downline: Array<{ user: string; status: string; earned: number; joinedAt: string }>;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  subscription: {
    status: string;
    plan: string;
    paymentMethod: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
  licenseKey: string | null;
  referralCode: string | null;
  referralClicks: number;
  totalReferrals: number;
  referralEarnings: number;
  referredBy: {
    name: string | null;
    email: string | null;
    code: string | null;
    status: string;
  } | null;
}

interface PayoutRow {
  id: string;
  userName: string;
  userEmail: string;
  amount: number;
  usdtAmount: number | null;
  walletAddress: string;
  txHash: string | null;
  status: string;
  commissionCount: number;
  processedAt: string | null;
  createdAt: string;
}

interface PaymentRow {
  id: string;
  userName: string;
  userEmail: string;
  plan: string;
  amount: number;
  method: string;
  txHash: string;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const { status } = useSession();
  const [tab, setTab] = useState<"overview" | "users" | "affiliates" | "payments" | "payouts">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [expandedAff, setExpandedAff] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [txHashInput, setTxHashInput] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") redirect("/login");
    if (status === "authenticated") {
      loadStats();
      loadUsers();
      loadAffiliates();
      loadPayouts();
      loadPayments();
    }
  }, [status]);

  const loadAffiliates = () =>
    fetch("/api/admin/affiliates")
      .then((r) => r.json())
      .then((d) => setAffiliates(d.affiliates || []))
      .catch(() => {});

  const loadStats = () =>
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});

  const loadUsers = (q = "") =>
    fetch(`/api/admin/users?search=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {});

  const loadPayouts = () =>
    fetch("/api/admin/payouts")
      .then((r) => r.json())
      .then((d) => setPayouts(d.payouts || []))
      .catch(() => {});

  const loadPayments = () =>
    fetch("/api/admin/payments")
      .then((r) => r.json())
      .then((d) => setPayments(d.payments || []))
      .catch(() => {});

  const handlePaymentReview = async (paymentId: string, action: string) => {
    if (action === "approve" && !confirm("Xác nhận đã kiểm tra giao dịch trên TronScan và DUYỆT?")) return;
    if (action === "reject" && !confirm("Từ chối thanh toán này?")) return;
    setProcessing(paymentId);
    await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, action }),
    });
    setProcessing(null);
    loadPayments();
    loadStats();
    loadUsers(search);
  };

  const handlePayout = async (payoutId: string, action: string) => {
    setProcessing(payoutId);
    const body: Record<string, string> = { payoutId, action };
    if (action === "complete") {
      body.txHash = txHashInput[payoutId] || "";
      if (!body.txHash) {
        alert("Please enter the transaction hash first.");
        setProcessing(null);
        return;
      }
    }
    await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setProcessing(null);
    loadPayouts();
    loadStats();
  };

  const handleUserAction = async (userId: string, action: string, value?: string) => {
    setActionLoading(userId);
    await fetch(`/api/admin/users/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, value }),
    });
    setActionLoading(null);
    loadUsers(search);
    loadStats();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers(search);
  };

  const exportUsersCsv = () => {
    const head = ["Name", "Email", "Role", "Status", "Plan", "Payment", "License", "ReferredBy", "Referrals", "Earned", "Joined"];
    const rows = users.map((u) => [
      u.name || "",
      u.email || "",
      u.role,
      u.subscription?.status || "NONE",
      u.subscription?.plan || "",
      u.subscription?.paymentMethod || "",
      u.licenseKey || "",
      u.referredBy ? `${u.referredBy.email || u.referredBy.name || ""} (${u.referredBy.code || ""})` : "",
      String(u.totalReferrals),
      u.referralEarnings.toFixed(2),
      new Date(u.createdAt).toLocaleDateString(),
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `autoflow-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!stats) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-500">Loading admin panel...</div>
      </div>
    );
  }

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "text-green-400 bg-green-500/10",
      TRIAL: "text-amber-400 bg-amber-500/10",
      EXPIRED: "text-zinc-400 bg-zinc-500/10",
      CANCELLED: "text-zinc-400 bg-zinc-500/10",
      PAST_DUE: "text-red-400 bg-red-500/10",
      PENDING: "text-amber-400 bg-amber-500/10",
      PROCESSING: "text-blue-400 bg-blue-500/10",
      COMPLETED: "text-green-400 bg-green-500/10",
      FAILED: "text-red-400 bg-red-500/10",
      APPROVED: "text-green-400 bg-green-500/10",
      REJECTED: "text-red-400 bg-red-500/10",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${colors[s] || "text-zinc-400 bg-zinc-500/10"}`}>
        {s}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      {/* Header */}
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-zinc-400 hover:text-white text-sm font-semibold">
              ← Dashboard
            </Link>
            <span className="text-white font-black">Admin Panel</span>
          </div>
          <div className="flex gap-1 bg-zinc-900 rounded-xl p-1">
            {(["overview", "users", "affiliates", "payments", "payouts"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  tab === t ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* ===== OVERVIEW ===== */}
        {tab === "overview" && (
          <div className="space-y-8">
            {/* Financial report */}
            <div>
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">💰 Báo cáo tài chính</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Doanh thu (đã duyệt)", value: `$${stats.grossRevenue.toFixed(2)}`, color: "text-emerald-400", big: true },
                  { label: "Lợi nhuận ròng", value: `$${stats.netRevenue.toFixed(2)}`, color: "text-green-400", big: true },
                  { label: "Hoa hồng còn nợ", value: `$${stats.commissionsOwed.toFixed(2)}`, color: "text-amber-400" },
                  { label: "Đã trả affiliate", value: `$${stats.totalPaidOut.toFixed(2)}`, color: "text-teal-400" },
                ].map((s) => (
                  <div key={s.label} className={`bg-zinc-900/50 border rounded-2xl p-5 text-center ${s.big ? "border-emerald-500/20" : "border-white/5"}`}>
                    <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                    <div className="text-zinc-500 text-[11px] font-bold uppercase mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Users & affiliate counts */}
            <div>
              <h2 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">👥 Người dùng & Affiliate</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Tổng đăng ký", value: stats.totalUsers, color: "text-indigo-400" },
                  { label: "Khách trả phí", value: stats.paidCustomers, color: "text-green-400" },
                  { label: "Đang dùng thử", value: stats.trialUsers, color: "text-amber-400" },
                  { label: "Mới (7 ngày)", value: stats.recentSignups, color: "text-purple-400" },
                  { label: "Đang active", value: stats.activeSubscriptions, color: "text-green-400" },
                  { label: "Tổng giới thiệu", value: stats.totalReferrals, color: "text-teal-400" },
                  { label: "Giới thiệu active", value: stats.activeReferrals, color: "text-emerald-400" },
                  { label: "Chờ duyệt (TT + rút)", value: stats.pendingPayments + stats.pendingPayouts, color: "text-orange-400" },
                ].map((s) => (
                  <div key={s.label} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5 text-center">
                    <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                    <div className="text-zinc-500 text-[11px] font-bold uppercase mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== USERS ===== */}
        {tab === "users" && (
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or name..."
                className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/40 focus:outline-none"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-colors"
              >
                Search
              </button>
              <button
                type="button"
                onClick={exportUsersCsv}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-bold transition-colors border border-white/10"
                title="Xuất danh sách ra file CSV (mở bằng Excel)"
              >
                ⬇ CSV
              </button>
            </form>

            <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500 text-left text-xs border-b border-white/5">
                      <th className="p-4 font-bold">User</th>
                      <th className="p-4 font-bold">Status</th>
                      <th className="p-4 font-bold">Plan</th>
                      <th className="p-4 font-bold">Payment</th>
                      <th className="p-4 font-bold">License</th>
                      <th className="p-4 font-bold">Referred By</th>
                      <th className="p-4 font-bold">Referrals</th>
                      <th className="p-4 font-bold">Earned</th>
                      <th className="p-4 font-bold">Joined</th>
                      <th className="p-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02]">
                        <td className="p-4">
                          <div className="text-white font-semibold text-sm flex items-center gap-1.5">
                            {u.name || "—"}
                            {u.role === "ADMIN" && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-black">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-zinc-500 text-xs">{u.email}</div>
                          {u.referralCode && (
                            <div className="text-teal-400/70 text-[10px] font-mono mt-0.5">
                              ref: {u.referralCode}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          {u.subscription ? statusBadge(u.subscription.status) : statusBadge("NONE")}
                        </td>
                        <td className="p-4 text-zinc-400 text-xs">
                          {u.subscription?.plan || "—"}
                        </td>
                        <td className="p-4 text-zinc-400 text-xs">
                          {u.subscription?.paymentMethod || "—"}
                        </td>
                        <td className="p-4">
                          <code className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                            {u.licenseKey ? `${u.licenseKey.slice(0, 12)}...` : "—"}
                          </code>
                        </td>
                        <td className="p-4">
                          {u.referredBy ? (
                            <div>
                              <div className="text-zinc-300 text-xs">
                                {u.referredBy.name || u.referredBy.email || "—"}
                              </div>
                              <div className="text-teal-400/70 text-[10px] font-mono">
                                {u.referredBy.code}
                              </div>
                            </div>
                          ) : (
                            <span className="text-zinc-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="p-4 text-zinc-300 text-sm font-bold">
                          {u.totalReferrals}
                        </td>
                        <td className="p-4 text-emerald-400 font-bold text-sm">
                          ${u.referralEarnings.toFixed(2)}
                        </td>
                        <td className="p-4 text-zinc-500 text-xs">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {u.subscription?.status !== "ACTIVE" && (
                              <button
                                onClick={() => handleUserAction(u.id, "activate", "MONTHLY")}
                                disabled={actionLoading === u.id}
                                className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-[10px] font-bold hover:bg-green-600/30 disabled:opacity-50"
                              >
                                Activate
                              </button>
                            )}
                            {u.subscription?.status === "ACTIVE" && (
                              <button
                                onClick={() => handleUserAction(u.id, "suspend")}
                                disabled={actionLoading === u.id}
                                className="px-2 py-1 bg-red-600/20 text-red-400 rounded text-[10px] font-bold hover:bg-red-600/30 disabled:opacity-50"
                              >
                                Suspend
                              </button>
                            )}
                            <button
                              onClick={() => handleUserAction(u.id, "extend_trial", "15")}
                              disabled={actionLoading === u.id}
                              className="px-2 py-1 bg-amber-600/20 text-amber-400 rounded text-[10px] font-bold hover:bg-amber-600/30 disabled:opacity-50"
                            >
                              +15d Trial
                            </button>
                            <button
                              onClick={() => handleUserAction(u.id, "reset_device")}
                              disabled={actionLoading === u.id}
                              className="px-2 py-1 bg-zinc-600/20 text-zinc-400 rounded text-[10px] font-bold hover:bg-zinc-600/30 disabled:opacity-50"
                            >
                              Reset Device
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.length === 0 && (
                <div className="p-8 text-center text-zinc-500 text-sm">No users found.</div>
              )}
            </div>
          </div>
        )}

        {/* ===== AFFILIATES (leaderboard + downline tree) ===== */}
        {tab === "affiliates" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold">Affiliate ({affiliates.length})</h2>
                <p className="text-zinc-500 text-xs mt-1">
                  Bấm vào một affiliate để xem danh sách người họ giới thiệu (downline).
                </p>
              </div>
              <button onClick={loadAffiliates} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
                Refresh
              </button>
            </div>

            <div className="space-y-2">
              {affiliates.map((a) => (
                <div key={a.userId} className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setExpandedAff(expandedAff === a.userId ? null : a.userId)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-zinc-500 text-xs">{expandedAff === a.userId ? "▼" : "▶"}</span>
                      <div className="min-w-0">
                        <div className="text-white font-semibold text-sm truncate">{a.name || a.email}</div>
                        <div className="text-zinc-500 text-xs truncate">
                          <code className="text-teal-400">{a.code}</code> · {a.clicks} clicks · {a.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 shrink-0 text-right">
                      <div>
                        <div className="text-white font-bold text-sm">{a.totalReferrals}</div>
                        <div className="text-zinc-600 text-[10px] uppercase">Giới thiệu</div>
                      </div>
                      <div>
                        <div className="text-green-400 font-bold text-sm">{a.activeReferrals}</div>
                        <div className="text-zinc-600 text-[10px] uppercase">Active</div>
                      </div>
                      <div>
                        <div className="text-emerald-400 font-bold text-sm">${a.totalEarned.toFixed(2)}</div>
                        <div className="text-zinc-600 text-[10px] uppercase">Đã kiếm</div>
                      </div>
                      <div>
                        <div className="text-amber-400 font-bold text-sm">${a.pendingPayout.toFixed(2)}</div>
                        <div className="text-zinc-600 text-[10px] uppercase">Chờ rút</div>
                      </div>
                    </div>
                  </button>

                  {expandedAff === a.userId && (
                    <div className="border-t border-white/5 p-4 bg-zinc-950/40">
                      <div className="text-zinc-500 text-[11px] mb-2">
                        Ví USDT: {a.wallet ? <code className="text-zinc-300">{a.wallet}</code> : <span className="text-zinc-600">chưa đặt</span>}
                        {" · "}Đã trả: <span className="text-teal-400">${a.paidOut.toFixed(2)}</span>
                      </div>
                      {a.downline.length === 0 ? (
                        <div className="text-zinc-600 text-sm py-2">Chưa có ai.</div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-zinc-500 text-left text-xs border-b border-white/5">
                              <th className="py-2 font-bold">Người được giới thiệu</th>
                              <th className="py-2 font-bold">Trạng thái</th>
                              <th className="py-2 font-bold">Hoa hồng</th>
                              <th className="py-2 font-bold">Ngày tham gia</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {a.downline.map((d, i) => (
                              <tr key={i}>
                                <td className="py-2 text-zinc-300">{d.user}</td>
                                <td className="py-2">{statusBadge(d.status)}</td>
                                <td className="py-2 text-emerald-400 font-bold">${d.earned.toFixed(2)}</td>
                                <td className="py-2 text-zinc-500 text-xs">{new Date(d.joinedAt).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {affiliates.length === 0 && (
                <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-8 text-center text-zinc-500 text-sm">
                  Chưa có affiliate nào (chưa ai giới thiệu được người dùng).
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== PAYMENTS (USDT upgrade review) ===== */}
        {tab === "payments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold">USDT Upgrade Payments</h2>
              <button
                onClick={loadPayments}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Refresh
              </button>
            </div>
            <p className="text-zinc-500 text-xs">
              Kiểm tra TxHash trên TronScan (đúng ví nhận, đúng số tiền, đã xác nhận) rồi bấm Duyệt để kích hoạt Pro.
            </p>

            <div className="space-y-3">
              {payments.map((p) => (
                <div key={p.id} className="bg-zinc-900/50 border border-white/10 rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-white font-bold">{p.userName || p.userEmail}</div>
                      <div className="text-zinc-500 text-xs">{p.userEmail}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-black text-xl">${p.amount.toFixed(2)}</div>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-zinc-500 text-[11px]">{p.plan} · {p.method}</span>
                        {statusBadge(p.status)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-3">
                    <div>
                      <span className="text-zinc-500">Submitted:</span>
                      <div className="text-zinc-300">{new Date(p.createdAt).toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-zinc-500">TxHash:</span>
                      <div className="text-zinc-300 font-mono text-[11px] truncate">
                        <a
                          href={`https://tronscan.org/#/transaction/${p.txHash}`}
                          target="_blank"
                          className="text-indigo-400 hover:underline"
                        >
                          {p.txHash}
                        </a>
                      </div>
                    </div>
                  </div>

                  {p.status === "PENDING" ? (
                    <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                      <button
                        onClick={() => handlePaymentReview(p.id, "approve")}
                        disabled={processing === p.id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        ✓ Duyệt & Kích hoạt
                      </button>
                      <button
                        onClick={() => handlePaymentReview(p.id, "reject")}
                        disabled={processing === p.id}
                        className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Từ chối
                      </button>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-white/5 text-zinc-500 text-xs">
                      {p.reviewedAt ? `Reviewed: ${new Date(p.reviewedAt).toLocaleString()}` : ""}
                    </div>
                  )}
                </div>
              ))}
              {payments.length === 0 && (
                <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-8 text-center text-zinc-500 text-sm">
                  No USDT payments yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== PAYOUTS ===== */}
        {tab === "payouts" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold">Payout Requests</h2>
              <button
                onClick={loadPayouts}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Refresh
              </button>
            </div>

            <div className="space-y-3">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="bg-zinc-900/50 border border-white/10 rounded-2xl p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-white font-bold">{p.userName || p.userEmail}</div>
                      <div className="text-zinc-500 text-xs">{p.userEmail}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-black text-xl">${p.amount.toFixed(2)}</div>
                      {statusBadge(p.status)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                    <div>
                      <span className="text-zinc-500">Wallet:</span>
                      <div className="text-zinc-300 font-mono text-[11px] truncate">
                        {p.walletAddress}
                      </div>
                    </div>
                    <div>
                      <span className="text-zinc-500">Commissions:</span>
                      <div className="text-zinc-300">{p.commissionCount} items</div>
                    </div>
                    <div>
                      <span className="text-zinc-500">Requested:</span>
                      <div className="text-zinc-300">{new Date(p.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <span className="text-zinc-500">TxHash:</span>
                      <div className="text-zinc-300 font-mono text-[11px] truncate">
                        {p.txHash ? (
                          <a
                            href={`https://tronscan.org/#/transaction/${p.txHash}`}
                            target="_blank"
                            className="text-indigo-400 hover:underline"
                          >
                            {p.txHash.slice(0, 16)}...
                          </a>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Admin Actions */}
                  {(p.status === "PENDING" || p.status === "PROCESSING") && (
                    <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                      {p.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => handlePayout(p.id, "process")}
                            disabled={processing === p.id}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            Mark Processing
                          </button>
                          <button
                            onClick={() => handlePayout(p.id, "reject")}
                            disabled={processing === p.id}
                            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {p.status === "PROCESSING" && (
                        <>
                          <input
                            type="text"
                            value={txHashInput[p.id] || ""}
                            onChange={(e) =>
                              setTxHashInput({ ...txHashInput, [p.id]: e.target.value })
                            }
                            placeholder="Paste TxHash..."
                            className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-emerald-500/40 focus:outline-none"
                          />
                          <button
                            onClick={() => handlePayout(p.id, "complete")}
                            disabled={processing === p.id}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            Complete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {payouts.length === 0 && (
                <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-8 text-center text-zinc-500 text-sm">
                  No payout requests yet.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
