"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function CheckoutRedirect() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const product = params.get("product");
    const mode = params.get("mode");
    const plan = params.get("plan");

    async function startCheckout() {
      try {
        const body =
          mode === "one-time" && product
            ? { product, mode: "one-time" }
            : { plan: plan || "MONTHLY" };

        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.status === 401) {
          const returnUrl = encodeURIComponent(window.location.href);
          router.push(`/login?callbackUrl=${returnUrl}`);
          return;
        }

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Lỗi tạo checkout");
        }

        const { url } = await res.json();
        window.location.href = url;
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
      }
    }

    startCheckout();
  }, [params, router]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-white font-semibold text-lg mb-2">Không thể tạo checkout</h2>
          <p className="text-white/50 text-sm mb-6">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2.5 rounded-xl border border-white/10 text-white/70 hover:text-white text-sm transition-colors"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">Đang chuyển hướng đến trang thanh toán...</p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <CheckoutRedirect />
    </Suspense>
  );
}
