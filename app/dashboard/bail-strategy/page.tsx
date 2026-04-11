"use client";

import type { Route } from "next";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

type ViewState = "form" | "loading" | "result";
type OffenseType = "non-bailable" | "bailable" | "ndps" | "uapa" | "pmla" | "unknown";
type CustodyDuration = "under-30" | "1-6mo" | "6-12mo" | "1-2yr" | "over-2yr";
type CourtStage = "sessions" | "magistrate" | "no-chargesheet" | "high-court";
type PreviousBail = "none" | "1-rejected" | "2plus-rejected" | "granted-cancelled";
type Eligibility = "Likely eligible" | "Uncertain" | "Unlikely eligible";

interface BailStrategyRequestBody {
  sections: string;
  offenseType: OffenseType | "";
  custodyDuration: CustodyDuration;
  courtStage: CourtStage;
  previousBail: PreviousBail;
  accusedTags: string[];
  age: string;
  firOrCnr: string;
  additionalContext: string;
}

interface BailGround {
  title: string;
  explanation: string;
}

interface BailPrecedent {
  case: string;
  citation: string;
  relevance: string;
}

interface BailStrategyResult {
  eligibility: Eligibility;
  custodyLabel: string;
  suretyRangeMin: number;
  suretyRangeMax: number;
  recommendedSection: string;
  recommendedCourt: string;
  escalationPath: string;
  grounds: BailGround[];
  precedents: BailPrecedent[];
  courtNote: string;
  biasWarning: string | null;
}

const INITIAL_FORM: BailStrategyRequestBody = {
  sections: "",
  offenseType: "",
  custodyDuration: "under-30",
  courtStage: "magistrate",
  previousBail: "none",
  accusedTags: [],
  age: "",
  firOrCnr: "",
  additionalContext: "",
};

const offenseOptions: Array<{ value: OffenseType; label: string }> = [
  { value: "non-bailable", label: "Non-bailable" },
  { value: "bailable", label: "Bailable" },
  { value: "ndps", label: "NDPS" },
  { value: "uapa", label: "UAPA" },
  { value: "pmla", label: "PMLA" },
  { value: "unknown", label: "Unknown" },
];

const custodyOptions: Array<{ value: CustodyDuration; label: string }> = [
  { value: "under-30", label: "Under 30 days" },
  { value: "1-6mo", label: "1 to 6 months" },
  { value: "6-12mo", label: "6 to 12 months" },
  { value: "1-2yr", label: "1 to 2 years" },
  { value: "over-2yr", label: "Over 2 years" },
];

const courtStageOptions: Array<{ value: CourtStage; label: string }> = [
  { value: "magistrate", label: "Magistrate" },
  { value: "sessions", label: "Sessions" },
  { value: "no-chargesheet", label: "No chargesheet" },
  { value: "high-court", label: "High Court" },
];

const previousBailOptions: Array<{ value: PreviousBail; label: string }> = [
  { value: "none", label: "None" },
  { value: "1-rejected", label: "1 rejected" },
  { value: "2plus-rejected", label: "2+ rejected" },
  { value: "granted-cancelled", label: "Granted then cancelled" },
];

const accusedTagOptions = [
  "first-time offender",
  "student",
  "sole breadwinner",
  "senior citizen",
  "woman accused",
  "medical condition",
  "cooperated in investigation",
  "clean antecedents",
  "local residence",
  "dependent family",
  "parity with co-accused",
  "recovery complete",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function eligibilityBadgeClasses(value: Eligibility) {
  if (value === "Likely eligible") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  }
  if (value === "Uncertain") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  }
  return "border-red-500/30 bg-red-500/10 text-red-700";
}

function BailStrategyPageContent() {
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>("form");
  const [form, setForm] = useState<BailStrategyRequestBody>(INITIAL_FORM);
  const [result, setResult] = useState<BailStrategyResult | null>(null);
  const [error, setError] = useState("");

  function PillGroup<T extends string>({
    options,
    value,
    onChange,
    multi = false,
  }: {
    options: Array<{ value: T; label: string }>;
    value: T | T[];
    onChange: (value: T | T[]) => void;
    multi?: boolean;
  }) {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = multi
            ? Array.isArray(value) && value.includes(option.value)
            : value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                if (multi) {
                  const current = Array.isArray(value) ? value : [];
                  const next = current.includes(option.value)
                    ? current.filter((entry) => entry !== option.value)
                    : [...current, option.value];
                  onChange(next);
                  return;
                }

                onChange(option.value);
              }}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                selected
                  ? "border-[#B8952A] bg-[#B8952A]/10 text-[#B8952A]"
                  : "border-border/60 bg-bg-primary text-text-secondary hover:border-[#B8952A]/40 hover:text-text-primary"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  const accusedTagPills = useMemo(
    () => accusedTagOptions.map((tag) => ({ value: tag, label: tag })),
    [],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.offenseType) {
      setError("Select an offense type to continue.");
      return;
    }

    setError("");
    setViewState("loading");

    try {
      const response = await fetch("/api/bail-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as { strategy?: BailStrategyResult; error?: string };

      if (!response.ok || !data.strategy) {
        throw new Error(data.error || "Unable to check eligibility right now.");
      }

      setResult(data.strategy);
      setViewState("result");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to check eligibility right now.");
      setViewState("form");
    }
  }

  function resetFormView() {
    setViewState("form");
    setError("");
  }

  return (
    <DashboardShell>
      <DashboardHeader />
      <main className="w-full flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <div className="flex flex-col gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-[#B8952A]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Back to dashboard
            </Link>
            <div className="rounded-3xl border border-border/50 bg-bg-card p-8 shadow-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#B8952A]">Bail Strategy System</p>
              <h1 className="mt-3 text-3xl font-semibold text-text-primary">Check bail eligibility with filing strategy</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
                Build a structured Indian-law bail brief covering custody posture, likely grounds, precedents, and the most suitable court strategy.
              </p>
            </div>
          </div>

          <section className={viewState === "form" ? "block" : "hidden"}>
            <div className="rounded-2xl border border-[#B8952A]/25 bg-[#B8952A]/10 px-5 py-4 text-sm leading-6 text-text-primary">
              This tool supports legal preparation and internal review. Final advice and filings must be checked against the current statute, court record, and local practice.
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              <section className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-text-primary">Core matter details</h2>
                  <p className="mt-1 text-sm text-text-secondary">Enter the legal posture first, then add supporting context.</p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-sm font-medium text-text-primary">Sections</span>
                    <input
                      value={form.sections}
                      onChange={(event) => setForm((current) => ({ ...current, sections: event.target.value }))}
                      placeholder="IPC 420, CrPC 439, NDPS 37, BNSS equivalent"
                      className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-[#B8952A] focus:ring-4 focus:ring-[#B8952A]/10"
                    />
                  </label>

                  <div className="md:col-span-2">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">Offense type</span>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B8952A]">Required</span>
                    </div>
                    <PillGroup
                      options={offenseOptions}
                      value={form.offenseType}
                      onChange={(value) => {
                        setForm((current) => ({ ...current, offenseType: value as OffenseType }));
                        setError("");
                      }}
                    />
                    {error && !form.offenseType ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
                  </div>

                  <div className="md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-text-primary">Custody duration</span>
                    <PillGroup
                      options={custodyOptions}
                      value={form.custodyDuration}
                      onChange={(value) => setForm((current) => ({ ...current, custodyDuration: value as CustodyDuration }))}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-text-primary">Court stage</span>
                    <PillGroup
                      options={courtStageOptions}
                      value={form.courtStage}
                      onChange={(value) => setForm((current) => ({ ...current, courtStage: value as CourtStage }))}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-text-primary">Previous bail</span>
                    <PillGroup
                      options={previousBailOptions}
                      value={form.previousBail}
                      onChange={(value) => setForm((current) => ({ ...current, previousBail: value as PreviousBail }))}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-text-primary">Accused tags</span>
                    <PillGroup
                      options={accusedTagPills}
                      value={form.accusedTags}
                      onChange={(value) => setForm((current) => ({ ...current, accusedTags: value as string[] }))}
                      multi
                    />
                  </div>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-text-primary">Age</span>
                    <input
                      value={form.age}
                      onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))}
                      placeholder="24 / 68 / juvenile claim"
                      className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-[#B8952A] focus:ring-4 focus:ring-[#B8952A]/10"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-text-primary">FIR / CNR</span>
                    <input
                      value={form.firOrCnr}
                      onChange={(event) => setForm((current) => ({ ...current, firOrCnr: event.target.value }))}
                      placeholder="FIR 112/2026 or CNR DLCT01..."
                      className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-[#B8952A] focus:ring-4 focus:ring-[#B8952A]/10"
                    />
                  </label>

                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-sm font-medium text-text-primary">Additional context</span>
                    <textarea
                      value={form.additionalContext}
                      onChange={(event) => setForm((current) => ({ ...current, additionalContext: event.target.value }))}
                      rows={5}
                      placeholder="Add charge-sheet timing, recovery status, co-accused parity, medical concerns, employment, or any fact affecting bail."
                      className="rounded-2xl border border-border/50 bg-bg-primary px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-[#B8952A] focus:ring-4 focus:ring-[#B8952A]/10"
                    />
                  </label>
                </div>

                {error && form.offenseType ? (
                  <div className="mt-5 rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-4 text-sm text-red-600">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-[#B8952A] px-5 text-sm font-semibold text-white transition hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-[#B8952A]/20"
                >
                  Check eligibility →
                </button>
              </section>
            </form>
          </section>

          <section className={viewState === "loading" ? "block" : "hidden"}>
            <div className="rounded-3xl border border-border/50 bg-bg-card px-6 py-20 shadow-panel">
              <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#B8952A]/20 bg-[#B8952A]/10">
                  <svg viewBox="0 0 48 48" className="h-10 w-10 animate-spin text-[#B8952A]" fill="none">
                    <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="4" opacity="0.2" />
                    <path d="M24 6a18 18 0 0 1 18 18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-text-primary">Checking eligibility...</h2>
                <p className="mt-3 text-sm leading-6 text-text-secondary">Analyzing sections, custody, and precedents.</p>
              </div>
            </div>
          </section>

          <section className={viewState === "result" && result ? "block" : "hidden"}>
            {result ? (
              <div className="space-y-6">
                <div className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#B8952A]">Bail Strategy Brief</p>
                      <h2 className="mt-3 text-2xl font-semibold text-text-primary">Eligibility and filing strategy summary</h2>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${eligibilityBadgeClasses(result.eligibility)}`}>
                        {result.eligibility}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-border/60 bg-bg-primary px-3 py-1 text-xs font-semibold text-text-primary">
                        {result.recommendedCourt}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl border border-border/50 bg-bg-card p-5 shadow-panel">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Custody</p>
                    <p className="mt-3 text-lg font-semibold text-text-primary">{result.custodyLabel}</p>
                  </div>
                  <div className="rounded-3xl border border-border/50 bg-bg-card p-5 shadow-panel">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Surety Range</p>
                    <p className="mt-3 text-lg font-semibold text-text-primary">
                      {formatCurrency(result.suretyRangeMin)} - {formatCurrency(result.suretyRangeMax)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-border/50 bg-bg-card p-5 shadow-panel">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Section</p>
                    <p className="mt-3 text-lg font-semibold text-text-primary">{result.recommendedSection}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
                  <h3 className="text-lg font-semibold text-text-primary">Grounds</h3>
                  <div className="mt-5 space-y-4">
                    {result.grounds.map((ground) => (
                      <div key={`${ground.title}-${ground.explanation}`} className="flex gap-3">
                        <span className="mt-2 h-2.5 w-2.5 flex-none rounded-full bg-[#B8952A]" />
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{ground.title}</p>
                          <p className="mt-1 text-sm leading-6 text-text-secondary">{ground.explanation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
                  <div className="flex flex-wrap gap-3">
                    <span className="inline-flex items-center rounded-full border border-[#B8952A]/20 bg-[#B8952A]/10 px-3 py-1 text-xs font-semibold text-[#B8952A]">
                      {result.recommendedSection}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border/60 bg-bg-primary px-3 py-1 text-xs font-semibold text-text-primary">
                      {result.recommendedCourt}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-text-primary">Court Strategy</h3>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">{result.courtNote}</p>
                  {result.escalationPath.trim() ? (
                    <div className="mt-5 rounded-2xl border border-border/50 bg-bg-primary px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Escalation Path</p>
                      <p className="mt-2 text-sm leading-6 text-text-primary">{result.escalationPath}</p>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
                  <h3 className="text-lg font-semibold text-text-primary">Precedents</h3>
                  <div className="mt-5 space-y-4">
                    {result.precedents.map((precedent) => (
                      <div key={`${precedent.case}-${precedent.citation}`} className="rounded-2xl border border-border/50 bg-bg-primary px-4 py-4">
                        <p className="text-sm font-semibold text-text-primary">{precedent.case}</p>
                        <p className="mt-1 font-mono text-xs text-text-secondary">{precedent.citation}</p>
                        <p className="mt-3 text-sm leading-6 text-text-secondary">{precedent.relevance}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {result.biasWarning ? (
                  <div className="rounded-3xl border border-red-500/25 bg-red-500/10 p-6 shadow-panel">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Bias Warning</p>
                    <p className="mt-3 text-sm leading-6 text-red-700">{result.biasWarning}</p>
                  </div>
                ) : null}

                <div className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/generate-application" as Route)}
                      className="flex h-12 items-center justify-center rounded-2xl bg-[#B8952A] px-5 text-sm font-semibold text-white transition hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-[#B8952A]/20"
                    >
                      Generate Application
                    </button>
                    <button
                      type="button"
                      onClick={resetFormView}
                      className="flex h-12 items-center justify-center rounded-2xl border border-border/60 bg-bg-primary px-5 text-sm font-semibold text-text-primary transition hover:border-[#B8952A]/50 hover:text-[#B8952A] focus:outline-none focus:ring-4 focus:ring-[#B8952A]/10"
                    >
                      Return to form
                    </button>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-text-secondary">
                    This structured output is for legal research and drafting support. Bail outcomes depend on case facts, local practice, judicial discretion, and the latest statutory position.
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </DashboardShell>
  );
}

function BailStrategyFallback() {
  return (
    <DashboardShell>
      <DashboardHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <svg viewBox="0 0 48 48" className="h-10 w-10 animate-spin text-[#B8952A]" fill="none">
          <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="4" opacity="0.2" />
          <path d="M24 6a18 18 0 0 1 18 18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </main>
    </DashboardShell>
  );
}

export default function BailStrategyPage() {
  return (
    <Suspense fallback={<BailStrategyFallback />}>
      <BailStrategyPageContent />
    </Suspense>
  );
}
