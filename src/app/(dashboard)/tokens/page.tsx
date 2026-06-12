"use client";

import { useEffect, useState } from "react";
import { TOKEN_PACKAGES, MODEL_PRICING } from "@/lib/tokens";

type Transaction = {
  id: string;
  amount: number;
  balanceAfter: number;
  type: string;
  modelId?: string;
  appId?: string;
  description?: string;
  createdAt: string;
};

const TYPE_STYLE: Record<string, { label: string; color: string }> = {
  PURCHASE:  { label: "Nạp tiền",   color: "text-emerald-400 bg-emerald-400/10" },
  BONUS:     { label: "Khuyến mãi", color: "text-amber-400 bg-amber-400/10" },
  USAGE:     { label: "Sử dụng",    color: "text-red-400 bg-red-400/10" },
  AFFILIATE: { label: "Affiliate",  color: "text-purple-400 bg-purple-400/10" },
  REFUND:    { label: "Hoàn tiền",  color: "text-blue-400 bg-blue-400/10" },
};

const PROVIDER_COLOR: Record<string, string> = {
  google:    "border-blue-500/30 bg-blue-500/5",
  openai:    "border-emerald-500/30 bg-emerald-500/5",
  anthropic: "border-orange-500/30 bg-orange-500/5",
};

export default function TokensPage() {
  const [tab, setTab] = useState<"buy" | "history" | "models">("buy");
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tokens/balance")
      .then((r) => r.json())
      .then((d) => {
        setBalance(d.balance ?? 0);
        setTransactions(d.transactions ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handlePurchase(packageId: string) {
    setPurchasing(packageId);
    try {
      const res = await fetch("/api/tokens/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPurchasing(null);
    }
  }

  const tabs = [
    { id: "buy", label: "💳 Nạp Credits" },
    { id: "history", label: "📋 Lịch sử" },
    { id: "models", label: "🤖 Mô hình AI" },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header + Balance */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Credits & Token</h1>
        <p className="text-zinc-400 text-sm">Nạp credits để sử dụng toàn bộ hệ sinh thái AI</p>
      </div>

      {/* Balance Card */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-zinc-400 text-sm mb-1">Số dư hiện tại</div>
            {loading ? (
              <div className="h-10 w-48 bg-zinc-800 rounded animate-pulse" />
            ) : (
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black text-white">
                  {(balance ?? 0).toLocaleString()}
                </span>
                <span className="text-zinc-400 text-sm">credits</span>
                <span className="text-zinc-500 text-sm">
                  ≈ ${((balance ?? 0) * 0.001).toFixed(2)} USD
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setTab("buy")}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
          >
            + Nạp thêm
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-zinc-900 border border-white/5 mb-8 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-white/10 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* BUY TAB */}
      {tab === "buy" && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {TOKEN_PACKAGES.map((pkg) => {
              const total = pkg.credits + pkg.bonus;
              return (
                <div
                  key={pkg.id}
                  className={`rounded-2xl border p-5 relative flex flex-col ${
                    pkg.popular
                      ? "border-purple-500/50 bg-purple-500/5"
                      : "border-white/10 bg-zinc-900"
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-purple-600 text-white text-xs font-bold">
                      Phổ biến
                    </div>
                  )}
                  <div className="mb-4">
                    <div className="text-white font-semibold text-lg">{pkg.name}</div>
                    <div className="text-3xl font-black text-white mt-2">
                      ${(pkg.usdCents / 100).toFixed(0)}
                    </div>
                    <div className="text-zinc-400 text-xs mt-0.5">USD</div>
                  </div>
                  <div className="flex-1 space-y-1.5 mb-5">
                    <div className="text-emerald-400 text-sm font-medium">
                      {pkg.credits.toLocaleString()} credits
                    </div>
                    {pkg.bonus > 0 && (
                      <div className="text-amber-400 text-xs">
                        + {pkg.bonus.toLocaleString()} bonus 🎁
                      </div>
                    )}
                    <div className="text-zinc-500 text-xs">
                      Tổng: {total.toLocaleString()} credits
                    </div>
                  </div>
                  <button
                    onClick={() => handlePurchase(pkg.id)}
                    disabled={purchasing === pkg.id}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      pkg.popular
                        ? "bg-purple-600 hover:bg-purple-500 text-white"
                        : "border border-white/10 hover:border-white/20 text-white hover:bg-white/5"
                    } disabled:opacity-50`}
                  >
                    {purchasing === pkg.id ? "Đang xử lý..." : "Mua ngay"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-zinc-500 text-xs text-center">
            1 credit = $0.001 USD · Thanh toán qua Stripe (thẻ quốc tế)
          </p>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === "history" && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900 overflow-hidden">
          {transactions.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-sm">Chưa có giao dịch nào</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-zinc-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Loại</th>
                  <th className="text-left px-5 py-3 hidden sm:table-cell">Mô tả</th>
                  <th className="text-right px-5 py-3">Credits</th>
                  <th className="text-right px-5 py-3 hidden md:table-cell">Số dư</th>
                  <th className="text-right px-5 py-3 hidden sm:table-cell">Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const style = TYPE_STYLE[tx.type] || { label: tx.type, color: "text-zinc-400 bg-zinc-400/10" };
                  return (
                    <tr key={tx.id} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.color}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell text-zinc-400">
                        {tx.description || (tx.modelId ? `Model: ${tx.modelId}` : "—")}
                      </td>
                      <td className={`px-5 py-3.5 text-right font-semibold ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right hidden md:table-cell text-zinc-400">
                        {tx.balanceAfter.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right hidden sm:table-cell text-zinc-500 text-xs">
                        {new Date(tx.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* MODELS TAB */}
      {tab === "models" && (
        <div className="space-y-3">
          {Object.entries(MODEL_PRICING).map(([id, model]) => (
            <div
              key={id}
              className={`rounded-xl border p-4 flex items-center justify-between gap-4 flex-wrap ${PROVIDER_COLOR[model.provider] || "border-white/10 bg-zinc-900"}`}
            >
              <div className="flex items-center gap-3">
                <div className="text-xl">
                  {model.provider === "google" ? "🔵" : model.provider === "openai" ? "🟢" : "🟠"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">{model.name}</span>
                    {model.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs">
                        {model.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-zinc-500 text-xs mt-0.5">{model.description}</div>
                </div>
              </div>
              <div className="flex gap-6 text-xs text-right flex-shrink-0">
                <div>
                  <div className="text-zinc-500">Input /1k tokens</div>
                  <div className="text-white font-semibold">{model.inputPer1k} cr</div>
                </div>
                <div>
                  <div className="text-zinc-500">Output /1k tokens</div>
                  <div className="text-white font-semibold">{model.outputPer1k} cr</div>
                </div>
              </div>
            </div>
          ))}
          <p className="text-zinc-600 text-xs text-center pt-2">
            1 credit = $0.001 · Giá đã bao gồm markup vận hành
          </p>
        </div>
      )}
    </div>
  );
}
