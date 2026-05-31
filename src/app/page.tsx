import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      {/* Nav */}
      <nav className="border-b border-white/5 sticky top-0 z-50 bg-zinc-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-600/30">
              AF
            </div>
            <span className="font-black text-white tracking-tight text-lg">Auto Flow Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-zinc-400 hover:text-white text-sm font-semibold transition-colors">
              Sign In
            </Link>
            <Link
              href="/login"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-indigo-600/20"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-8">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-indigo-400 text-xs font-bold">15-Day Free Trial — No Credit Card</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6">
          Automate Google Flow<br />
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Like a Pro
          </span>
        </h1>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10">
          Bulk submit prompts, storyboard queue, overnight auto-run with Veo 3.1 & Nano Banana.
          Save hours of manual work every day.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-indigo-600/30 hover:shadow-indigo-500/40"
          >
            Start Free Trial
          </Link>
          <a
            href="#pricing"
            className="px-8 py-4 border border-white/10 hover:border-white/20 text-white rounded-2xl font-bold text-lg transition-colors"
          >
            View Pricing
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: "🚀",
              title: "Bulk Automation",
              desc: "Submit hundreds of prompts automatically. Text mode or storyboard with images.",
            },
            {
              icon: "🌙",
              title: "Overnight Mode",
              desc: "Set it and forget it. Auto-retry, keep-alive, and queue recovery built-in.",
            },
            {
              icon: "🧠",
              title: "AI Studio",
              desc: "Storyboard AI & VeoFlow integration. Generate pro prompts with one click.",
            },
            {
              icon: "🎯",
              title: "Smart DOM Setup",
              desc: "Visual teach mode — click once, map forever. Works even after Google updates.",
            },
            {
              icon: "💰",
              title: "Affiliate Program",
              desc: "Earn 20% recurring commission. Share your link, get paid in USDT monthly.",
            },
            {
              icon: "🔐",
              title: "Secure & Private",
              desc: "License key verification. Your API keys never leave your browser.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-black text-white text-center mb-12">Simple Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Trial */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-8">
            <h3 className="text-zinc-400 font-bold text-sm uppercase mb-2">Free Trial</h3>
            <div className="text-4xl font-black text-white mb-1">$0</div>
            <p className="text-zinc-500 text-sm mb-6">15 days, full features</p>
            <ul className="space-y-3 text-sm text-zinc-400 mb-8">
              <li>✅ All features unlocked</li>
              <li>✅ No credit card required</li>
              <li>✅ Affiliate link included</li>
            </ul>
            <Link
              href="/login"
              className="block text-center py-3 border border-white/10 hover:border-white/20 text-white rounded-xl font-bold transition-colors"
            >
              Start Free
            </Link>
          </div>

          {/* Monthly */}
          <div className="bg-indigo-600/10 border-2 border-indigo-500/30 rounded-2xl p-8 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-black px-4 py-1 rounded-full">
              POPULAR
            </div>
            <h3 className="text-indigo-400 font-bold text-sm uppercase mb-2">Pro Monthly</h3>
            <div className="text-4xl font-black text-white mb-1">$19.99</div>
            <p className="text-zinc-500 text-sm mb-6">per month</p>
            <ul className="space-y-3 text-sm text-zinc-400 mb-8">
              <li>✅ Unlimited prompts</li>
              <li>✅ Overnight mode</li>
              <li>✅ AI Studio + VeoFlow</li>
              <li>✅ Priority support</li>
            </ul>
            <Link
              href="/login"
              className="block text-center py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors shadow-lg"
            >
              Get Started
            </Link>
          </div>

          {/* Yearly */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-8">
            <h3 className="text-purple-400 font-bold text-sm uppercase mb-2">Pro Yearly</h3>
            <div className="text-4xl font-black text-white mb-1">$149.99</div>
            <p className="text-zinc-500 text-sm mb-6">per year — save 37%</p>
            <ul className="space-y-3 text-sm text-zinc-400 mb-8">
              <li>✅ Everything in Monthly</li>
              <li>✅ Save $89.89/year</li>
              <li>✅ Early access to features</li>
            </ul>
            <Link
              href="/login"
              className="block text-center py-3 border border-purple-500/30 hover:border-purple-500/50 text-white rounded-xl font-bold transition-colors"
            >
              Save 37%
            </Link>
          </div>
        </div>
      </section>

      {/* Affiliate CTA */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-emerald-600/10 to-teal-600/10 border border-emerald-500/20 rounded-3xl p-10 text-center">
          <h2 className="text-3xl font-black text-white mb-4">Earn While You Share</h2>
          <p className="text-zinc-400 max-w-xl mx-auto mb-8">
            Get your unique referral link. Earn <span className="text-emerald-400 font-bold">20% recurring commission</span> for
            every paying user you refer. Paid monthly in USDT.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-lg transition-colors shadow-xl shadow-emerald-600/20"
          >
            Join Affiliate Program
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-zinc-600 text-sm">
            &copy; {new Date().getFullYear()} Auto Flow Pro. All rights reserved.
          </div>
          <div className="flex gap-6 text-zinc-500 text-sm">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
