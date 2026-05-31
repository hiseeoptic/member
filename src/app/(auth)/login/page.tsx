"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-600/40">
              AF
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black text-white tracking-tight">
                Auto Flow Pro
              </h1>
              <p className="text-[10px] text-indigo-400 font-bold tracking-[0.3em] uppercase">
                Membership
              </p>
            </div>
          </div>
          <p className="text-zinc-500 text-sm">
            Bulk automation for Google Flow — Veo 3.1 & Nano Banana
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-8 backdrop-blur">
          <h2 className="text-white font-bold text-lg mb-2">Get Started</h2>
          <p className="text-zinc-400 text-sm mb-8">
            Sign in to access your dashboard. New users get a{" "}
            <span className="text-indigo-400 font-semibold">15-day free trial</span>.
          </p>

          {ref && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-6">
              <p className="text-emerald-400 text-xs font-semibold">
                Referred by code: {ref}
              </p>
            </div>
          )}

          <button
            onClick={() =>
              signIn("google", {
                callbackUrl: "/dashboard",
              })
            }
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-900 font-bold py-3.5 px-6 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <p className="text-zinc-600 text-[11px] text-center mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { icon: "15", label: "Day Trial" },
            { icon: "∞", label: "Unlimited" },
            { icon: "$", label: "Earn Referrals" },
          ].map((f) => (
            <div
              key={f.label}
              className="bg-zinc-900/30 border border-white/5 rounded-xl p-3 text-center"
            >
              <div className="text-indigo-400 font-black text-lg">{f.icon}</div>
              <div className="text-zinc-500 text-[10px] font-bold uppercase mt-1">
                {f.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="text-zinc-500">Loading...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
