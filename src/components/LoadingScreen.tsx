"use client";

import { useState, useEffect, useCallback } from "react";
import { BrandMark } from "./BrandMark";

const STORAGE_KEY = "bidguard-visited";
const DURATION = 5000; // 5 seconds
const UPDATE_INTERVAL = 30; // update progress every 30ms for smooth bar

export default function LoadingScreen({ children }: { children: React.ReactNode }) {
  const [isFirstVisit, setIsFirstVisit] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // URL override for testing: ?loader=1 forces show, ?loader=0 forces hide
    const params = new URLSearchParams(window.location.search);
    const override = params.get("loader");
    if (override === "1") {
      setIsFirstVisit(true);
      return;
    }
    if (override === "0") {
      setIsFirstVisit(false);
      setVisible(false);
      return;
    }

    // Check localStorage on mount (client-side only)
    try {
      const visited = localStorage.getItem(STORAGE_KEY);
      if (visited) {
        setIsFirstVisit(false);
        setVisible(false);
      } else {
        setIsFirstVisit(true);
      }
    } catch {
      // localStorage unavailable — skip loader
      setIsFirstVisit(false);
      setVisible(false);
    }
  }, []);

  const finish = useCallback(() => {
    setExiting(true);
    // Allow fade-out animation to complete
    setTimeout(() => {
      setVisible(false);
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // ignore
      }
    }, 600);
  }, []);

  useEffect(() => {
    if (!isFirstVisit) return;

    let raf: number;
    let start: number | null = null;

    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const pct = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(pct);

      if (elapsed < DURATION) {
        raf = requestAnimationFrame(step);
      } else {
        finish();
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isFirstVisit, finish]);

  // While checking localStorage, render nothing (avoids flash)
  if (isFirstVisit === null) return <>{children}</>;

  if (!visible) return <>{children}</>;

  return (
    <>
      {/* Loading overlay */}
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-[600ms] ease-out ${
          exiting ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{ background: "var(--navy-900)" }}
        aria-hidden="true"
      >
        {/* Animated logo container */}
        <div className="relative flex flex-col items-center">
          {/* Glow ring */}
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-20"
            style={{
              background: "radial-gradient(circle, var(--saffron-500) 0%, transparent 70%)",
              width: "160px",
              height: "160px",
              transform: "translate(-50%, -50%)",
              left: "50%",
              top: "50%",
            }}
          />

          {/* Logo with pulse + rotate animation */}
          <div
            className="relative mb-8"
            style={{
              animation: "loaderPulse 2s ease-in-out infinite",
            }}
          >
            <BrandMark size={90} tone="inverse" alt="BidGuard AI" />
          </div>

          {/* Progress bar */}
          <div className="w-56 h-1.5 rounded-full bg-white/10 overflow-hidden mb-6">
            <div
              className="h-full rounded-full transition-all duration-75 ease-linear"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, var(--saffron-500), var(--saffron-400))",
                boxShadow: "0 0 12px rgba(255, 107, 43, 0.4)",
              }}
            />
          </div>

          {/* Percentage text */}
          <div className="text-[13px] font-bold text-white/50 tracking-widest mb-8 tabular-nums">
            {Math.round(progress)}%
          </div>

          {/* Team credit */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <p
              className="text-[13px] font-semibold tracking-[0.12em] uppercase"
              style={{ color: "var(--saffron-400)" }}
            >
              Made by Team Anveshak 2.0
            </p>
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          </div>
        </div>

        {/* Decorative corner accents */}
        <div className="absolute top-0 left-0 w-24 h-24 border-l-2 border-t-2 border-white/5 rounded-tl-3xl" />
        <div className="absolute top-0 right-0 w-24 h-24 border-r-2 border-t-2 border-white/5 rounded-tr-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 border-l-2 border-b-2 border-white/5 rounded-bl-3xl" />
        <div className="absolute bottom-0 right-0 w-24 h-24 border-r-2 border-b-2 border-white/5 rounded-br-3xl" />
      </div>

      {/* Render children behind the overlay so they preload */}
      <div className={exiting ? "opacity-100" : "opacity-0"}>{children}</div>

      {/* Keyframe animation (injected via style tag to avoid globals.css change) */}
      <style>{`
        @keyframes loaderPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </>
  );
}
