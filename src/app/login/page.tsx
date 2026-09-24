"use client";
import { useState, FormEvent } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      // Show success and redirect after a brief delay
      setError("");
      const redirectTo = data?.data?.redirect || "/bidder";
      setTimeout(() => {
        window.location.href = redirectTo;
      }, 300);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleDemo = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-[var(--foreground)] mb-2">
            BIDGUARD AI
          </h1>
          <p className="text-[var(--foreground-secondary)]">
            Login to your account
          </p>
        </div>

        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent)] hover:opacity-90 text-white font-medium py-2.5 px-4 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-[var(--surface)] px-3 text-[var(--foreground-tertiary)]">
                or
              </span>
            </div>
          </div>

          <button
            onClick={handleGoogleDemo}
            className="w-full bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--foreground)] font-medium py-2.5 px-4 rounded-lg border border-[var(--border)] transition-colors"
          >
            Continue with Google
          </button>
        </div>

        <p className="text-center text-sm text-[var(--foreground-tertiary)] mt-6">
          Don&apos;t have an account?{" "}
          <a
            href="/register"
            className="text-[var(--accent)] hover:underline"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
