"use client";
import { useState, useEffect } from "react";
import { Shield, Lock, Loader2 } from "lucide-react";

const ADMIN_PASSWORD = "admin@bidverify2026";
const SESSION_KEY = "bidverify_admin_auth";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "true") {
      setAuthenticated(true);
    }
    setChecking(false);

    // Clear admin auth when component unmounts (navigating away from admin)
    return () => {
      sessionStorage.removeItem(SESSION_KEY);
    };
  }, []);

  if (checking) return null;
  if (authenticated) return <>{children}</>;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTimeout(() => {
      if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, "true");
        setAuthenticated(true);
      } else {
        setError("Invalid password. Access denied.");
        setLoading(false);
      }
    }, 500);
  }

  return (
    <div className="min-h-screen bg-white/10 flex items-center justify-center px-4">
      <div className="bg-[#161617] border border-white/10 rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
        <div className="w-16 h-16 bg-[#0071e3] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">BIDGUARD AI — Admin Panel</h1>
        <p className="text-sm text-[#a1a1a6] mb-6">Enter the admin password to access the control center.</p>
        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <Lock className="w-4 h-4 text-[#86868b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full pl-10 pr-4 py-3 border border-white/12 rounded-lg text-sm focus:border-[#2997ff] focus:ring-0 focus:border-transparent"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-[#ff6961] mb-4">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-[#0071e3] text-white font-medium py-3 rounded-lg hover:bg-[#2997ff] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {loading ? "Verifying..." : "Access Admin Panel"}
          </button>
        </form>
        <p className="text-xs text-[#86868b] mt-4">Password: admin@bidverify2026</p>
      </div>
    </div>
  );
}
