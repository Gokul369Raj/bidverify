"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shield, Mail, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

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
      const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      setMessage({ type: "success", text: data.ok ? "If an account exists with this email, a reset link has been sent. In demo mode, check the URL for the token." : data.error });
    } catch { setMessage({ type: "error", text: "Failed to send reset email" }); }
    setLoading(false);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken, newPassword }) });
      const data = await res.json();
      setMessage(data.ok ? { type: "success", text: "Password reset successful! Redirecting to login..." } : { type: "error", text: data.error });
      if (data.ok) setTimeout(() => window.location.href = "/login", 2000);
    } catch { setMessage({ type: "error", text: "Failed to reset password" }); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col justify-center py-12 px-4">
      <div className="max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-[var(--accent)] rounded-xl flex items-center justify-center"><Shield className="w-7 h-7 text-white" /></div>
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{resetToken ? "Reset Password" : "Forgot Password"}</h1>
          <p className="text-sm text-[var(--foreground-secondary)] mt-2"><Link href="/login" className="text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center justify-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Back to login</Link></p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-8 shadow-sm">
          {message && (
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${message.type === "success" ? "bg-[var(--success-light)] border border-[var(--success)] text-[var(--success)]" : "bg-[var(--danger-light)] border border-[var(--danger)] text-[var(--danger)]"}`}>
              {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : null}
              {message.text}
            </div>
          )}

          {!resetToken ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <p className="text-sm text-[var(--foreground-secondary)]">Enter your registered email address and we will send you a password reset link.</p>
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-tertiary)]" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field !pl-10" placeholder="you@example.com" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-[var(--accent)] text-white font-medium py-2.5 rounded-lg hover:bg-[var(--accent-hover)] text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Send Reset Link
              </button>
              <div className="bg-[var(--warning-light)] border border-[var(--warning)] rounded-lg p-3 text-xs text-[var(--warning)]">
                Demo mode: In production, this sends a real email. For demo, check the server logs for the reset token.
              </div>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <p className="text-sm text-[var(--foreground-secondary)]">Enter your new password below.</p>
              <div>
                <label className="block text-sm font-medium mb-1">New Password (min 8 chars)</label>
                <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-field" placeholder="New password" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-[var(--accent)] text-white font-medium py-2.5 rounded-lg hover:bg-[var(--accent-hover)] text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Reset Password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" /></div>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
