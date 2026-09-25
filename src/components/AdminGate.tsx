"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { Lock, Loader2, ShieldCheck, AlertCircle, ArrowLeft, Landmark } from "lucide-react";

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

    // Clear admin auth when the component unmounts (navigating away from admin)
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
        setError("Invalid credentials. Access denied and recorded.");
        setLoading(false);
      }
    }, 450);
  }

  return (
    <div className="min-h-screen bg-[var(--navy-900)] flex flex-col">
      <div className="tricolor-bar" />

      {/* Utility bar */}
      <div className="govt-header on-dark">
        <div className="container-wide flex items-center justify-between">
          <span className="text-white/65">Restricted Area — Administrative Access</span>
          <Link href="/" className="flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Return to Portal
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[430px]">
          <div className="text-center mb-7 on-dark">
            <div className="inline-flex items-center justify-center mb-5">
              <BrandLogo size="lg" tone="inverse" href={null} />
            </div>
            <h1 className="text-[23px] font-extrabold text-white tracking-tight">
              Admin Control Center
            </h1>
            <p className="text-[13px] text-white/55 mt-2 leading-relaxed">
              Administrative access is restricted. Enter the control-centre
              passphrase to continue.
            </p>
          </div>

          <div className="bg-white rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] overflow-hidden">
            <div className="px-6 py-4 bg-[var(--navy-50)] border-b border-[var(--border)] flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--navy-800)] flex items-center justify-center shrink-0">
                <Landmark className="w-4 h-4 text-white" aria-hidden="true" />
              </span>
              <div>
                <div className="text-[13px] font-bold text-[var(--navy-800)] leading-tight">
                  Administrator Authentication
                </div>
                <div className="text-[11px] text-[var(--foreground-tertiary)] leading-tight">
                  Role: SUPER_ADMIN
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="notice notice-danger" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="admin-pass" className="field-label">Control-Centre Passphrase</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--foreground-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                  <input
                    id="admin-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter passphrase"
                    autoFocus
                    autoComplete="off"
                    className="input-field !pl-10 !py-3"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !password}
                className="btn btn-navy w-full btn-lg cursor-pointer"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Verifying…</>
                ) : (
                  <><ShieldCheck className="w-4 h-4" aria-hidden="true" /> Access Control Center</>
                )}
              </button>

              <div className="notice notice-info !py-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-[12px]">
                  Demonstration passphrase: <code className="mono font-semibold">admin@bidverify2026</code>
                </span>
              </div>
            </form>
          </div>

          <p className="text-center text-[11.5px] text-white/35 mt-6 leading-relaxed">
            All access attempts are logged with IP address and timestamp
            <br />
            under the Information Technology Act, 2000.
          </p>
        </div>
      </div>
    </div>
  );
}
