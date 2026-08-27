"use client";
import Link from "next/link";
import { ClipboardCheck, Info, ArrowRight } from "lucide-react";

export default function BidderCompliancePage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Compliance</h1>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">View compliance results for your submitted bids.</p>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 text-center">
        <ClipboardCheck className="w-12 h-12 text-[var(--foreground-tertiary)] mx-auto mb-3" />
        <h3 className="font-semibold text-[var(--foreground)] mb-2">Compliance Results Appear After Verification</h3>
        <p className="text-sm text-[var(--foreground-secondary)] mb-4">
          Once you submit a bid and the procurement officer runs verification, compliance results will appear here.
          Check My Bids to track your submission status.
        </p>
        <Link href="/bidder/bids" className="text-sm text-[var(--accent)] hover:opacity-80 font-medium">
          View My Bids →
        </Link>
      </div>

      <div className="bg-[var(--accent)]/12 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-[var(--foreground)] text-sm font-medium mb-1">
          <Info className="w-4 h-4 text-[var(--accent)]" />
          How Compliance Works
        </div>
        <div className="text-xs text-[var(--foreground-secondary)] space-y-1">
          <p>1. You upload documents (GST, PAN, Udyam, etc.)</p>
          <p>2. AI extracts and classifies your documents</p>
          <p>3. Government verification adapters check your data</p>
          <p>4. Deterministic rules evaluate each requirement</p>
          <p>5. You receive a compliance score with evidence</p>
        </div>
      </div>
    </div>
  );
}
