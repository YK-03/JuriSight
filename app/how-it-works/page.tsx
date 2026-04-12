"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useUser, SignInButton, Show, UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/app/Logo";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { Button } from "@/components/ui/button";
import type { CaseAnalysis } from "@/lib/analysis-types";
import { VerdictGauge } from "@/components/analysis/VerdictGauge";
import { RiskFactors } from "@/components/analysis/RiskFactors";
import { LegalReasoning } from "@/components/analysis/LegalReasoning";
import { ApplicableSections } from "@/components/analysis/ApplicableSections";
import { Precedents } from "@/components/analysis/Precedents";
import { Recommendations } from "@/components/analysis/Recommendations";

/* ── Pre-seeded case ──────────────────────────────────────────────── */

const DEMO_CASE = {
  title: "State vs. Ravi Kumar",
  description: `Ravi Kumar, a 34-year-old daily wage worker from East Delhi, has been accused of theft under IPC Section 379 after his employer alleged that cash amounting to ₹18,000 was missing from the shop premises. Ravi denies the charge and claims he was falsely implicated due to a personal dispute with the employer. He has no prior criminal record, has a family of four dependents, and has been in custody for 11 days. No direct evidence links him to the theft — the case rests entirely on the employer's statement.`,
  sections: ["IPC 379"],
  accusedProfile:
    "Daily wage worker, first-time offender, 11 days in custody, 4 dependents",
  jurisdiction: "Delhi",
};

/* ── Cache helpers (localStorage, 1-hour TTL) ─────────────────────── */

const CACHE_KEY = "jurisight_hiw_cache";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

type CacheEntry = {
  data: CaseAnalysis;
  ts: number;
};

function tryGetCache(): CaseAnalysis | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache(data: CaseAnalysis): void {
  try {
    const entry: CacheEntry = { data, ts: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

/* ── Page ──────────────────────────────────────────────────────────── */

export default function HowItWorksPage() {
  const { isSignedIn } = useUser();

  const [analysis, setAnalysis] = useState<CaseAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visibleSections, setVisibleSections] = useState(0);
  const [showStickyBar, setShowStickyBar] = useState(false);

  /* ── Fetch or cache ─────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1. Check cache
      const cached = tryGetCache();
      if (cached) {
        if (!cancelled) {
          setAnalysis(cached);
          setLoading(false);
          stagger();
        }
        return;
      }

      // 2. Call API
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseDescription: DEMO_CASE.description }),
        });
        if (!res.ok) throw new Error("API error");
        const json = await res.json();
        const result: CaseAnalysis = json.analysis;
        if (!cancelled) {
          setAnalysis(result);
          setCache(result);
          setLoading(false);
          stagger();
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    function stagger() {
      for (let i = 1; i <= 7; i++) {
        setTimeout(() => {
          if (!cancelled) setVisibleSections((prev) => Math.max(prev, i));
        }, i * 200);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Scroll listener for sticky bar ─────────────────────────────── */

  useEffect(() => {
    function onScroll() {
      setShowStickyBar(window.scrollY > 300);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Helpers ────────────────────────────────────────────────────── */

  const currentYear = new Date().getFullYear();

  function sectionClass(n: number) {
    return `transition-all duration-500 ease-out ${
      visibleSections >= n
        ? "opacity-100 translate-y-0"
        : "opacity-0 translate-y-4 pointer-events-none"
    }`;
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* ── Navbar (exact mirror from landing page) ─────────────────── */}
      <div className="mx-auto max-w-7xl px-6 pt-6">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:inline-flex border-amber-500/40 hover:bg-amber-500/10"
                >
                  Sign In
                </Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex border-amber-500/40 hover:bg-amber-500/10"
              >
                <Link href={"/dashboard" as Route}>Dashboard</Link>
              </Button>
              <UserButton />
            </Show>
          </div>
        </div>
      </div>

      {/* ── Hero strip ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-12 text-center">
        <span className="text-sm font-mono uppercase tracking-[0.28em] text-amber-500">
          Live Walkthrough
        </span>
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
          See a real case analyzed — no sign-up needed
        </h1>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
          We&rsquo;ve pre-loaded a realistic criminal matter. Scroll to see how
          JuriSight breaks it down.
        </p>
      </section>

      {/* ── Content area ───────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 pb-32 space-y-8">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-6">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 animate-pulse">
              Analyzing case — this takes a few seconds…
            </p>
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 animate-pulse"
              >
                <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                <div className="space-y-3">
                  <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-5/6 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-4/6 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-8 text-center">
            <p className="text-sm text-red-700 dark:text-red-300 mb-4">
              Analysis unavailable right now. Try the free eligibility check
              instead.
            </p>
            <Link
              href={"/guest" as Route}
              className="inline-flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline"
            >
              Go to Eligibility Check →
            </Link>
          </div>
        )}

        {/* ── Analysis results ─────────────────────────────────────── */}
        {analysis && (
          <>
            {/* Section 1 — Case snapshot */}
            <div className={sectionClass(1)}>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {DEMO_CASE.title}
                  </h2>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded">
                    {DEMO_CASE.sections.join(", ")}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {DEMO_CASE.jurisdiction}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                    Live Analysis
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2 — Verdict + Risk Score */}
            <div className={sectionClass(2)}>
              <VerdictGauge
                verdict={analysis.verdict}
                riskScore={analysis.riskScore}
                summary={analysis.summary}
                biasWarning={analysis.biasWarning}
              />
            </div>

            {/* Section 3 — Risk Factors */}
            <div className={sectionClass(3)}>
              <RiskFactors riskFactors={analysis.riskFactors} />
            </div>

            {/* Section 4 — Legal Reasoning */}
            <div className={sectionClass(4)}>
              <LegalReasoning legalReasoning={analysis.legalReasoning} />
            </div>

            {/* Section 5 — Applicable Sections */}
            <div className={sectionClass(5)}>
              <ApplicableSections sections={analysis.applicableSections} />
            </div>

            {/* Section 6 — Precedents */}
            <div className={sectionClass(6)}>
              <Precedents precedents={analysis.precedents} />
            </div>

            {/* Section 7 — Recommendations */}
            <div className={sectionClass(7)}>
              <Recommendations recommendations={analysis.recommendations} />
            </div>

            {/* ── Conversion strip ────────────────────────────────────── */}
            <div className={sectionClass(7)}>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-8 text-center mt-4">
                <p className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  This was a live AI analysis of a real case scenario.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  {isSignedIn ? (
                    <Button
                      asChild
                      size="lg"
                      className="inline-flex h-11 items-center rounded-md border border-amber-500/70 bg-amber-500 px-6 font-semibold text-white transition-all duration-300 hover:brightness-105"
                    >
                      <Link href={"/dashboard" as Route}>
                        Go to Dashboard →
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      size="lg"
                      className="inline-flex h-11 items-center rounded-md border border-amber-500/70 bg-amber-500 px-6 font-semibold text-white transition-all duration-300 hover:brightness-105"
                    >
                      <Link href={"/sign-up" as Route}>
                        Analyze Your Own Case →
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="lg">
                    <Link href={"/guest" as Route}>
                      Try Free Eligibility Check
                    </Link>
                  </Button>
                </div>
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Full access includes case history, PDF exports, IPC/BNS
                  cross-reference, and AI legal chat.
                </p>
              </div>
            </div>
          </>
        )}

        {/* ── Disclaimer ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-amber-500 block mb-2">
            Disclaimer
          </span>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            JuriSight provides AI-assisted legal decision support for
            institutional review only. It is not legal advice, does not create an
            advocate-client relationship, and must not replace independent
            judicial or professional legal judgment.
          </p>
        </div>
      </div>

      {/* ── Sticky bottom bar ──────────────────────────────────────── */}
      <div
        className={`fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg transition-transform duration-300 ${
          showStickyBar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto max-w-5xl px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
            Analyzing your own case takes 30 seconds.
          </p>
          {isSignedIn ? (
            <Button
              asChild
              size="sm"
              className="inline-flex items-center rounded-md border border-amber-500/70 bg-amber-500 px-4 font-semibold text-white transition-all hover:brightness-105 ml-auto"
            >
              <Link href={"/dashboard" as Route}>Go to Dashboard →</Link>
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              className="inline-flex items-center rounded-md border border-amber-500/70 bg-amber-500 px-4 font-semibold text-white transition-all hover:brightness-105 ml-auto"
            >
              <Link href={"/sign-up" as Route}>Get Started Free →</Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 dark:border-gray-700 px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 font-mono uppercase tracking-[0.16em]">
          <span className="text-amber-500">JuriSight</span>
          <span className="text-gray-400/60 dark:text-gray-500/60">
            &bull;
          </span>
          <span>{currentYear}</span>
          <span className="text-gray-400/60 dark:text-gray-500/60">
            &bull;
          </span>
          <span>All Rights Reserved</span>
        </div>
      </footer>
    </main>
  );
}
