"use client";

import type { Route } from "next";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import type { BailStrategyCourtStage } from "@/lib/section-preservation";
import type { RetrievedAuthority } from "@/lib/authority-retrieval";

type ViewState = "form" | "loading" | "result";
type OffenseType = "non-bailable" | "bailable" | "ndps" | "uapa" | "pmla" | "unknown";
type CustodyDuration = "under-30" | "1-6mo" | "6-12mo" | "1-2yr" | "over-2yr";
type PreviousBail = "none" | "1-rejected" | "2plus-rejected" | "granted-cancelled";
type Eligibility = "Likely eligible" | "Uncertain" | "Unlikely eligible";

interface BailStrategyRequestBody {
  courtName: string;
  applicantName: string;
  fatherName: string;
  address: string;
  policeStation: string;
  sections: string;
  offenseType: OffenseType | "";
  custodyDuration: CustodyDuration;
  courtStage: BailStrategyCourtStage;
  previousBail: PreviousBail;
  accusedTags: string[];
  age: string;
  firOrCnr: string;
  additionalContext: string;
}

interface BailStrategyResult {
  eligibility: string;
  reasoning: string[];
  keyFactors: string[];
  suretyRangeMin: number;
  suretyRangeMax: number;
  suretyLabel?: string;
  authority?: "DETERMINISTIC" | "DETERMINISTIC_UNRESOLVED" | "DISCRETIONARY";
  ruleSummary?: string;
  discretionaryFactors?: string[];
  deterministicFindings?: {
    framework?: string;
    primarySection?: string;
    bailable?: boolean | null;
    supported?: boolean;
    severity?: string | null;
    defaultBailEligible?: boolean | null;
    defaultBailProvision?: string | null;
    chargesheetFiled?: boolean;
    specialActBar?: boolean;
    isJuvenile?: boolean;
  };
  manualVerificationWarnings?: string[];
  retrievedAuthorities?: RetrievedAuthority[];
}

const INITIAL_FORM: BailStrategyRequestBody = {
  courtName: "",
  applicantName: "",
  fatherName: "",
  address: "",
  policeStation: "",
  sections: "",
  offenseType: "",
  custodyDuration: "under-30",
  courtStage: "MAGISTRATE",
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

const courtStageOptions: Array<{ value: BailStrategyCourtStage; label: string }> = [
  { value: "MAGISTRATE", label: "Magistrate" },
  { value: "SESSIONS", label: "Sessions" },
  { value: "no-chargesheet", label: "No chargesheet" },
  { value: "HIGH_COURT", label: "High Court" },
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
    return "border-state-success/30 bg-state-success/10 text-state-success";
  }
  if (value === "Uncertain") {
    return "border-state-warning/30 bg-state-warning/10 text-state-warning";
  }
  return "border-state-error/30 bg-state-error/10 text-state-error";
}

function formatDiscretionaryFactor(factor: string) {
  if (factor.startsWith("Offense: ")) {
    const offense = factor.slice("Offense: ".length);
    const [description, severity] = offense.split(", Severity: ");
    const sectionMatch = description.match(/^(.*?) \((IPC|CrPC|BNSS|NDPS|UAPA|PMLA) (.+)\)$/);
    const naturalDescription = sectionMatch
      ? `${sectionMatch[1]} offence under Section ${sectionMatch[3]} ${sectionMatch[2]}`
      : `${description.toLowerCase()} offence`;
    return severity ? `${naturalDescription} (${severity} severity)` : naturalDescription;
  }

  if (factor.startsWith("Custody served: ")) {
    return factor.slice("Custody served: ".length).split(" (")[0] + " in custody";
  }

  if (factor === "Investigation status: Chargesheet filed") {
    return "Investigation complete; charge-sheet filed";
  }

  if (factor === "Investigation status: Investigation ongoing (chargesheet not filed)") {
    return "Investigation ongoing; charge-sheet not filed";
  }

  if (factor.startsWith("Prior bail history: ")) {
    const history = factor.slice("Prior bail history: ".length);
    const historyLabels: Record<string, string> = {
      None: "No previous bail rejection",
      "1 rejected": "One previous bail rejection",
      "2+ rejected": "Two or more previous bail rejections",
      "Granted then cancelled": "Previous bail was granted and later cancelled",
    };
    return historyLabels[history] || history;
  }

  if (factor.startsWith("Procedural forum: ")) {
    return factor.slice("Procedural forum: ".length);
  }

  if (factor.startsWith("Accused profile factors: ")) {
    return `Mitigating factors: ${factor.slice("Accused profile factors: ".length)}`;
  }

  return factor;
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
            <Button
              key={option.value}
              type="button"
              variant={selected ? "secondary" : "ghost"}
              size="sm"
              className={selected ? "border-accent/50 bg-accent/10 text-accent hover:bg-accent/10" : "border-border/60"}
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
            >
              {option.label}
            </Button>
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

    if (!form.courtName.trim()) {
      setError("Court name is required.");
      return;
    }
    if (!form.applicantName.trim()) {
      setError("Applicant name is required.");
      return;
    }
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
      
      const data = (await response.json()) as { strategy?: BailStrategyResult; error?: string; success?: boolean };

      if (!response.ok || data.success === false || !data.strategy) {
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
      <main className="w-full flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <div className="flex flex-col gap-4">
            <Button asChild variant="ghost" size="sm" className="w-fit pl-0">
              <Link href="/dashboard">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Back to dashboard
              </Link>
            </Button>
            <div className="rounded-3xl border border-border/50 bg-bg-card p-8 shadow-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Bail strategy</p>
              <h1 className="mt-3 text-3xl font-semibold text-text-primary">Bail eligibility assessment</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
                Review custody, potential grounds, relevant case law, and court strategy for the matter.
              </p>
            </div>
          </div>

          <section className={viewState === "form" ? "block" : "hidden"}>
            <div className="rounded-2xl border border-accent/25 bg-accent/10 px-5 py-4 text-sm leading-6 text-text-primary">
              Use this assessment to support preparation. Check final advice and filings against the current statute, court record, and local practice.
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              <section className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-text-primary">Core matter details</h2>
                  <p className="mt-1 text-sm text-text-secondary">Start with the matter details, then add any relevant context.</p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="flex flex-col gap-2 md:col-span-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">Court Name</span>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Required</span>
                    </div>
                    <input
                      value={form.courtName}
                      onChange={(event) => setForm((current) => ({ ...current, courtName: event.target.value }))}
                      placeholder="Sessions Judge, Saket Courts, New Delhi"
                      className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">Applicant Name</span>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Required</span>
                    </div>
                    <input
                      value={form.applicantName}
                      onChange={(event) => setForm((current) => ({ ...current, applicantName: event.target.value }))}
                      placeholder="Rajesh Kumar"
                      className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-text-primary">Father&apos;s Name</span>
                    <input
                      value={form.fatherName}
                      onChange={(event) => setForm((current) => ({ ...current, fatherName: event.target.value }))}
                      placeholder="Shri Ram Kumar"
                      className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                  </label>

                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-sm font-medium text-text-primary">Address</span>
                    <input
                      value={form.address}
                      onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                      placeholder="R-42, Lajpat Nagar, New Delhi - 110024"
                      className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                  </label>

                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-sm font-medium text-text-primary">Sections</span>
                    <input
                      value={form.sections}
                      onChange={(event) => setForm((current) => ({ ...current, sections: event.target.value }))}
                      placeholder="IPC 420, CrPC 439, NDPS 37, BNSS equivalent"
                      className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                  </label>

                  <div className="md:col-span-2">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">Offense type</span>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Required</span>
                    </div>
                    <PillGroup
                      options={offenseOptions}
                      value={form.offenseType}
                      onChange={(value) => {
                        setForm((current) => ({ ...current, offenseType: value as OffenseType }));
                        setError("");
                      }}
                    />
                    {error && !form.offenseType ? <p className="mt-3 text-sm text-state-error">{error}</p> : null}
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
                      onChange={(value) => setForm((current) => ({ ...current, courtStage: value as BailStrategyCourtStage }))}
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
                      className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-text-primary">FIR / CNR</span>
                    <input
                      value={form.firOrCnr}
                      onChange={(event) => setForm((current) => ({ ...current, firOrCnr: event.target.value }))}
                      placeholder="FIR 112/2026 or CNR DLCT01..."
                      className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-text-primary">Police Station</span>
                    <input
                      value={form.policeStation}
                      onChange={(event) => setForm((current) => ({ ...current, policeStation: event.target.value }))}
                      placeholder="PS Hauz Khas, New Delhi"
                      className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                  </label>

                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-sm font-medium text-text-primary">Additional context</span>
                    <textarea
                      value={form.additionalContext}
                      onChange={(event) => setForm((current) => ({ ...current, additionalContext: event.target.value }))}
                      rows={5}
                      placeholder="Add charge-sheet timing, recovery status, co-accused parity, medical concerns, employment, or any fact affecting bail."
                      className="rounded-2xl border border-border/50 bg-bg-primary px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                  </label>
                </div>

                {error ? (
                  <div className="mt-5 rounded-2xl border border-state-error/25 bg-state-error/10 px-5 py-4 text-sm text-state-error">
                    <p>{error}</p>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="mt-6 w-full"
                >
                  Check eligibility →
                </Button>
              </section>
            </form>
          </section>

          <section className={viewState === "loading" ? "block" : "hidden"}>
            <div className="rounded-3xl border border-border/50 bg-bg-card px-6 py-20 shadow-panel">
              <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
                  <svg viewBox="0 0 48 48" className="h-10 w-10 animate-spin text-accent" fill="none">
                    <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="4" opacity="0.2" />
                    <path d="M24 6a18 18 0 0 1 18 18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-text-primary">Evaluating the case...</h2>
                <p className="mt-3 text-sm leading-6 text-text-secondary">Reviewing the relevant provisions and case factors...</p>
              </div>
            </div>
          </section>
          <section className={viewState === "result" && result ? "block" : "hidden"}>
            {result ? (
              <div className="space-y-6">
                <div className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="mt-3 text-2xl font-semibold text-text-primary">Bail Eligibility Summary</h2>
                    {result.manualVerificationWarnings && result.manualVerificationWarnings.length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-state-warning/30 bg-state-warning/10 p-4">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-state-warning" />
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-state-warning">
                            Manual Verification Warnings ({result.manualVerificationWarnings.length})
                          </h3>
                        </div>
                        <ul className="mt-2.5 space-y-1">
                          {result.manualVerificationWarnings.map((warning, idx) => (
                            <li key={idx} className="flex gap-2 text-xs text-text-primary">
                              <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-state-warning" />
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${eligibilityBadgeClasses(result.eligibility as Eligibility)}`}>
                        {result.eligibility}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-border/50 bg-bg-card p-5 shadow-panel">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Surety Range</p>
                    <p className="mt-3 text-lg font-semibold text-text-primary">
                      {result.suretyLabel || `${formatCurrency(result.suretyRangeMin)} - ${formatCurrency(result.suretyRangeMax)}`}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary opacity-80">
                      Indicative estimate. Exact surety is determined by the court.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-border/50 bg-bg-card p-5 shadow-panel">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                        {result.authority === "DISCRETIONARY" ? "Bail Assessment" : "Statutory Basis"}
                      </p>
                      {result.authority && result.authority !== "DISCRETIONARY" ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          result.authority === "DETERMINISTIC"
                            ? "border border-accent/30 bg-accent/10 text-accent"
                            : "border border-state-warning/30 bg-state-warning/10 text-state-warning"
                        }`}>
                          {result.authority === "DETERMINISTIC"
                            ? "Statutory basis"
                            : "Manual verification required"}
                        </span>
                      ) : null}
                    </div>
                    {result.authority === "DISCRETIONARY" ? (
                      <>
                        <p className="mt-3 text-sm font-medium leading-6 text-text-primary">
                          Bail is discretionary in this case. The following factors may influence the court&apos;s assessment.
                        </p>
                        {result.discretionaryFactors && result.discretionaryFactors.length > 0 && (
                          <ul className="mt-3 space-y-1.5">
                            {result.discretionaryFactors.map((factor, idx) => (
                              <li key={idx} className="flex gap-2 text-sm text-text-primary">
                                <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-text-secondary opacity-60" />
                                {formatDiscretionaryFactor(factor)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="mt-3 text-sm font-medium leading-6 text-text-primary">
                          {result.authority === "DETERMINISTIC_UNRESOLVED"
                            ? "The applicable statutory classification could not be established from the information provided."
                            : result.ruleSummary || (result.deterministicFindings?.supported ? "Evaluated against statutory bail provisions" : "The applicable statutory classification could not be established from the information provided.")}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-lg font-semibold text-text-primary">Reasoning</h3>
                    <span className="text-xs text-text-secondary">Analysis</span>
                  </div>
                  <div className="mt-5 space-y-4">
                    {result.reasoning?.map((point, idx) => (
                      <div key={idx} className="flex gap-3">
                        <span className="mt-2 h-2.5 w-2.5 flex-none rounded-full bg-accent" />
                        <p className="text-sm font-medium leading-6 text-text-primary">{point}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {result.keyFactors && result.keyFactors.length > 0 && (
                  <div className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
                    <h3 className="text-lg font-semibold text-text-primary">Key Factors</h3>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {result.keyFactors.map((factor, idx) => (
                        <span key={idx} className="inline-flex items-center rounded-full border border-border/60 bg-bg-primary px-3 py-1 text-xs font-medium text-text-primary">
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.retrievedAuthorities && result.retrievedAuthorities.length > 0 ? (
                  <div className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-lg font-semibold text-text-primary">Related Case Law</h3>
                    </div>
                    <div className="mt-5 space-y-4">
                      {result.retrievedAuthorities.map((authority) => (
                        <div key={authority.authorityId} className="rounded-2xl border border-border/50 bg-bg-primary p-4">
                          <div className="flex items-center justify-between gap-3">
                            {authority.judgmentUrl ? (
                              <a
                                href={authority.judgmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-accent underline-offset-4 hover:text-accent hover:underline"
                              >
                                {authority.caseName}
                              </a>
                            ) : (
                              <p className="text-sm font-semibold text-text-primary">{authority.caseName}</p>
                            )}
                            <span className="text-[11px] text-text-secondary">
                              {authority.provenance === "verified"
                                ? "Verified source"
                                : authority.provenance === "verified-metadata"
                                ? "Metadata reference"
                                : "Reference"}
                            </span>
                          </div>
                          {authority.court || authority.citation || authority.date || authority.source ? (
                            <p className="mt-1 text-xs text-text-secondary">
                              {[authority.court, authority.citation, authority.date, authority.source].filter(Boolean).join(" · ")}
                            </p>
                          ) : null}
                          {authority.derived?.legalPrinciple ? (
                            <p className="mt-3 text-sm leading-6 text-text-primary">{authority.derived.legalPrinciple}</p>
                          ) : null}
                          {(authority.derived?.matchedIssues?.length ?? 0) > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {authority.derived?.matchedIssues?.map((issue) => (
                                <span key={issue} className="rounded-full border border-border/60 bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary">
                                  {issue}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-xs leading-5 text-text-secondary">
                      These cases are provided as supporting references. Verify the cited authority against the current record and applicable law.
                    </p>
                  </div>
                ) : null}

                <div className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      onClick={resetFormView}
                    >
                      Edit matter details
                    </Button>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-text-secondary">
                    Final bail outcomes depend on the specific facts, filings, and judicial discretion.
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        </div>      </main>
    </DashboardShell>
  );
}

function BailStrategyFallback() {
  return (
    <DashboardShell>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <svg viewBox="0 0 48 48" className="h-10 w-10 animate-spin text-accent" fill="none">
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
