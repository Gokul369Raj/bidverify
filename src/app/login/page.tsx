"use client";
import { useState, FormEvent } from "react";
import Link from "next/link";
import { Shield, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }
      setError("");
      const redirectTo = data?.data?.redirect || "/bidder";
      setTimeout(() => { window.location.href = redirectTo; }, 300);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1D3A] via-[#0F2847] to-[#162D52] flex items-center justify-center px-4 py-12">
      {/* Background decorations */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-[var(--saffron)] to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div className="text-left">
              <div className="text-white font-bold text-2xl leading-none">BIDGUARD <span className="text-[var(--saffron)]">AI</span></div>
              <div className="text-blue-200/40 text-xs mt-0.5">Secure Procurement. Stronger India.</div>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-blue-200/60 text-sm">Login to your account</p>
        </div>

        {/* Form Card */}
        <div className="bg-white/[0.06] backdrop-blur-sm rounded-2xl border border-white/10 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-blue-200/80 mb-1.5">
                Email
              </label>
              <input
                id="email" type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm px-4 py-3 outline-none focus:border-[var(--saffron)] focus:ring-1 focus:ring-[var(--saffron)]/30 placeholder-blue-200/30 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-blue-200/80 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password" type={showPassword ? "text" : "password"} required
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl text-white text-sm px-4 py-3 pr-10 outline-none focus:border-[var(--saffron)] focus:ring-1 focus:ring-[var(--saffron)]/30 placeholder-blue-200/30 transition-all"
                  placeholder="Enter your password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200/40 hover:text-blue-200/70 cursor-pointer">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-[var(--saffron)] hover:bg-[var(--saffron-dark)] text-white font-semibold py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-saffron/20"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-transparent px-3 text-blue-200/30">or</span>
            </div>
          </div>

          <Link
            href="/register"
            className="block w-full text-center bg-white/5 hover:bg-white/10 text-white font-medium py-3 px-4 rounded-xl border border-white/10 transition-colors"
          >
            Create New Account
          </Link>
        </div>

        <p className="text-center text-sm text-blue-200/40 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-[var(--saffron)] hover:underline font-medium">
            Register as Bidder
          </Link>
        </p>

        <div className="text-center mt-4">
          <p className="text-[10px] text-blue-200/25">
            Smart India Hackathon 2026 • Team Anveshak 2.0
          </p>
        </div>
      </div>
    </div>
  );
}
