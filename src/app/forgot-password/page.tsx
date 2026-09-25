"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import AuthPanel from "@/components/AuthPanel";
import {
  Mail, Loader2, CircleCheck, ArrowLeft, AlertCircle, KeyRound, Lock, Info,
} from "lucide-react";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("token");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage({
        type: data.ok ? "success" : "error",
        text: data.ok
          ? "If an account exists with this email, a password reset link has been sent."
          : data.error,
      });
    } catch {
      setMessage({ type: "error", text: "Failed to send reset email. Please try again." });
    }
    setLoading(false);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const data = await res.json();
      setMessage(
        data.ok
          ? { type: "success", text: "Password reset successful. Redirecting to sign-in…" }
          : { type: "error", text: data.error }
      );
      if (data.ok) setTimeout(() => { window.location.href = "/login"; }, 1800);
    } catch {
      setMessage({ type: "error", text: "Failed to reset password. Please try again." });
    }
    setLoading(false);
  }

  const resetting = Boolean(resetToken);

  return (
    <div className="min-h-screen flex bg-[var(--surface-2)]">
      <AuthPanel
        title="Regain access to your procurement workspace."
        subtitle="Reset your BidGuard AI password securely. All credential changes are recorded in the platform audit trail."
        points={[
          "Reset links expire automatically for your security",
          "Every credential change is written to the audit log",
          "Multi-role access control across bidder and officer accounts",
        ]}
      />

      <div className="flex-1 flex flex-col min-h-screen">
        <div className="tricolor-bar lg:hidden" />

        <div className="lg:hidden flex items-center justify-between gap-3 px-5 py-3.5 bg-white border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandLogo size="sm" href={null} />
          </Link>
          <Link href="/login" className="text-[12.5px] font-semibold text-[var(--foreground-secondary)] hover:text-[var(--navy-800)]">
            Sign in
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-10 sm:py-14">
          <div className="w-full max-w-[420px]">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[var(--foreground-secondary)] hover:text-[var(--navy-800)] transition-colors mb-7"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back to sign-in
            </Link>

            <div className="mb-7">
              <span className="badge badge-navy mb-3">
                <KeyRound className="w-3 h-3" aria-hidden="true" />
                Account Recovery
              </span>
              <h1 className="text-[27px] font-extrabold text-[var(--navy-800)] tracking-tight leading-tight">
                {resetting ? "Set a new password" : "Forgot your password?"}
              </h1>
              <p className="text-[14px] text-[var(--foreground-secondary)] mt-2">
                {resetting
                  ? "Choose a strong new password for your account."
                  : "Enter your registered email and we will send you a secure reset link."}
              </p>
            </div>

            <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow)] p-7">
              {message && (
                <div
                  className={`notice mb-5 ${message.type === "success" ? "notice-success" : "notice-danger"}`}
                  role="status"
                >
                  {message.type === "success" ? (
                    <CircleCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              {!resetting ? (
                <form onSubmit={handleRequestReset} className="space-y-5">
                  <div>
                    <label htmlFor="fp-email" className="field-label">Registered Email ID</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[var(--foreground-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                      <input
                        id="fp-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-field !pl-10 !py-3"
                        placeholder="you@organisation.com"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="btn btn-navy w-full btn-lg">
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Sending link…</>
                    ) : (
                      "Send Reset Link"
                    )}
                  </button>

                  <div className="notice notice-info">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      Demonstration mode — no email is actually sent. The reset token is
                      written to the server console instead.
                    </span>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleReset} className="space-y-5">
                  <div>
                    <label htmlFor="fp-new" className="field-label">New Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[var(--foreground-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                      <input
                        id="fp-new"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-field !pl-10 !py-3"
                        placeholder="Minimum 8 characters"
                      />
                    </div>
                    <p className="field-hint">Use at least 8 characters with a mix of letters and numbers.</p>
                  </div>

                  <button type="submit" disabled={loading} className="btn btn-navy w-full btn-lg">
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Resetting…</>
                    ) : (
                      "Reset Password"
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--surface-2)] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--navy-700)]" aria-hidden="true" />
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
