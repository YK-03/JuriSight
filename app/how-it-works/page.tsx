"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useUser, SignInButton, Show, UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/app/Logo";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    number: "01",
    title: "Describe the Case",
    description:
      "Enter the FIR details, charge sheet, or a plain-language summary of the matter. Upload FIRs, charge sheets, or reference cases using FIR/CNR details.",
    detail: "Supports IPC, BNS, CrPC, and BNSS sections.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "AI Analyzes the Matter",
    description:
      "JuriSight identifies applicable sections, evaluates bail eligibility, flags risk factors, and surfaces AI-assisted precedent suggestions relevant to the case facts.",
    detail: "Analysis covers risk score, legal reasoning, and bias warnings.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21a48.25 48.25 0 0 1-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Act on the Report",
    description:
      "Get a structured report your team can act on — bail arguments, recommended next steps, and a plain-language summary you can share with the client's family.",
    detail: "Share reports securely via generated analysis links.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
];

const CAPABILITIES = [
  { label: "Bail Eligibility", desc: "Instant assessment against CrPC 436–439 and BNS equivalents" },
  { label: "Section Mapping", desc: "Identifies IPC, BNS, and special act sections from case facts" },
  { label: "AI-Assisted Precedents", desc: "Suggests relevant Supreme Court and High Court decisions based on case facts" },
  { label: "Risk Scoring", desc: "Quantified risk score with factor-by-factor breakdown" },
  { label: "Legal Chat", desc: "Ask follow-up questions on the case in plain language" },
  { label: "Client Handoff", desc: "Shareable plain-language case summaries" },
];

export default function HowItWorksPage() {
  const { isSignedIn } = useUser();
  const [showStickyBar, setShowStickyBar] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    function onScroll() {
      setShowStickyBar(window.scrollY > 300);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">

      {/* ── Navbar ───────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-6 pt-6">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button variant="outline" size="sm" className="hidden sm:inline-flex border-amber-500/40 hover:bg-amber-500/10">
                  Sign In
                </Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex border-amber-500/40 hover:bg-amber-500/10">
                <Link href={"/dashboard" as Route}>Dashboard</Link>
              </Button>
              <UserButton />
            </Show>
          </div>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-12 text-center">
        <span className="text-sm font-mono uppercase tracking-[0.28em] text-amber-500">
          How It Works
        </span>
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
          From case facts to actionable legal intelligence
        </h1>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
          JuriSight is built for legal aid providers — NALSA lawyers, NGO paralegals, and public defenders — who need fast, structured analysis on undertrial matters.
        </p>
      </section>

      <div className="mx-auto max-w-4xl px-6 pb-32 space-y-12">

        {/* ── 3-step flow ──────────────────────────────────────────────── */}
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-8 top-10 bottom-10 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />

          <div className="space-y-6">
            {STEPS.map((step) => (
              <div key={step.number} className="relative flex gap-6">
                {/* Icon bubble */}
                <div className="relative z-10 flex-shrink-0 w-16 h-16 rounded-2xl border border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  {step.icon}
                </div>

                {/* Content */}
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm px-6 py-5 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-amber-500 tracking-widest">{step.number}</span>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">{step.title}</h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{step.description}</p>
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Capabilities grid ────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-amber-500 mb-5">
            What's included
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CAPABILITIES.map((cap) => (
              <div key={cap.label} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm px-5 py-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{cap.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-8 text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Ready to analyze a case?
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Full analysis takes under 30 seconds.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {isSignedIn ? (
              <Button asChild size="lg" className="inline-flex h-11 items-center rounded-md border border-amber-500/70 bg-amber-500 px-6 font-semibold text-white hover:brightness-105">
                <Link href={"/dashboard" as Route}>Go to Dashboard →</Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="inline-flex h-11 items-center rounded-md border border-amber-500/70 bg-amber-500 px-6 font-semibold text-white hover:brightness-105">
                <Link href={"/sign-up" as Route}>Get Started Free →</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="lg">
              <Link href={"/guest" as Route}>Try Free Eligibility Check</Link>
            </Button>
          </div>
        </div>

        {/* ── Disclaimer ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-amber-500 block mb-2">
            Disclaimer
          </span>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            JuriSight provides AI-assisted legal decision support for institutional review only. It is not legal advice, does not create an advocate-client relationship, and must not replace independent judicial or professional legal judgment.
          </p>
        </div>
      </div>

      {/* ── Sticky bottom bar ────────────────────────────────────────── */}
      <div className={`fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg transition-transform duration-300 ${showStickyBar ? "translate-y-0" : "translate-y-full"}`}>
        <div className="mx-auto max-w-5xl px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
            Analyzing your own case takes 30 seconds.
          </p>
          {isSignedIn ? (
            <Button asChild size="sm" className="inline-flex items-center rounded-md border border-amber-500/70 bg-amber-500 px-4 font-semibold text-white hover:brightness-105 ml-auto">
              <Link href={"/dashboard" as Route}>Go to Dashboard →</Link>
            </Button>
          ) : (
            <Button asChild size="sm" className="inline-flex items-center rounded-md border border-amber-500/70 bg-amber-500 px-4 font-semibold text-white hover:brightness-105 ml-auto">
              <Link href={"/sign-up" as Route}>Get Started Free →</Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 dark:border-gray-700 px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 font-mono uppercase tracking-[0.16em]">
          <span className="text-amber-500">JuriSight</span>
          <span className="text-gray-400/60 dark:text-gray-500/60">&bull;</span>
          <span>{currentYear}</span>
          <span className="text-gray-400/60 dark:text-gray-500/60">&bull;</span>
          <span>All Rights Reserved</span>
        </div>
      </footer>
    </main>
  );
}
