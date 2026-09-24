"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import type { AnalyzeResponse } from "@/lib/analysis-types";
import {
  type IntakeFormState,
  type CaseHistoryStatus,
  INITIAL_FORM_STATE,
  buildCaseDescription,
  buildCasePayload,
} from "@/lib/case-intake";

const CASE_HISTORY_STORAGE_KEY = "jurisight_case_history";
const MAX_CASE_HISTORY_ITEMS = 20;

type CaseHistoryEntry = {
  id: string;
  caseTitle: string;
  summary: string;
  createdAt: string;
  status: CaseHistoryStatus;
};

type CreatedCaseResponse = {
  id: string;
};

function createCaseHistoryId() {
  return `case-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseStoredCaseHistory(raw: string | null): CaseHistoryEntry[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is CaseHistoryEntry => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const record = item as Partial<CaseHistoryEntry>;
      return (
        typeof record.id === "string" &&
        typeof record.caseTitle === "string" &&
        typeof record.summary === "string" &&
        typeof record.createdAt === "string" &&
        (record.status === "Intake" ||
          record.status === "Analyzing" ||
          record.status === "Action needed" ||
          record.status === "In progress" ||
          record.status === "Educated")
      );
    });
  } catch {
    return [];
  }
}

function buildCaseHistorySummary(data: AnalyzeResponse): string {
  const summary = data.analysis?.summary?.trim();
  if (summary) {
    return summary;
  }

  return "Analysis completed and ready for review.";
}

function buildCaseHistoryStatus(data: AnalyzeResponse): CaseHistoryStatus {
  const verdict = data.analysis?.verdict;
  if (verdict === "Mixed") {
    return "Action needed";
  }

  if (verdict === "Favorable") {
    return "Educated";
  }

  return "In progress";
}

function saveCaseHistoryEntry(form: IntakeFormState, data: AnalyzeResponse, caseId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const nextEntry: CaseHistoryEntry = {
    id: caseId || createCaseHistoryId(),
    caseTitle: form.caseTitle.trim() || form.whatHappened.trim().slice(0, 60) || "Untitled case",
    summary: buildCaseHistorySummary(data),
    createdAt: new Date().toISOString(),
    status: buildCaseHistoryStatus(data),
  };

  try {
    const existing = parseStoredCaseHistory(localStorage.getItem(CASE_HISTORY_STORAGE_KEY));
    localStorage.setItem(
      CASE_HISTORY_STORAGE_KEY,
      JSON.stringify([nextEntry, ...existing].slice(0, MAX_CASE_HISTORY_ITEMS)),
    );
    window.dispatchEvent(new Event("jurisight_cases_updated"));
  } catch {
    // Ignore localStorage failures so the analysis flow still succeeds.
  }
}



function AnalyzeIntakeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<IntakeFormState>(INITIAL_FORM_STATE);
  const [error, setError] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prefilledRef = useRef(false);

  useEffect(() => {
    if (prefilledRef.current) {
      return;
    }

    const query = searchParams.get("q")?.trim();
    if (!query) {
      return;
    }

    setForm((current) => ({
      ...current,
      whatHappened: current.whatHappened || query,
    }));
    prefilledRef.current = true;
  }, [searchParams]);

  const updateField = <K extends keyof IntakeFormState>(field: K, value: IntakeFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "whatHappened" && error) {
      setError("");
    }
    if (submitError) {
      setSubmitError("");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedNarrative = form.whatHappened.trim();
    if (trimmedNarrative.length < 20) {
      setError("Please describe what happened in at least 20 characters.");
      return;
    }

    if (!form.offenseType.trim()) {
      setSubmitError("Please select an offense classification.");
      return;
    }

    if (form.priorRecord === null) {
      setSubmitError("Please select the prior criminal record status.");
      return;
    }

    setError("");
    setSubmitError("");
    setIsSubmitting(true);

    const caseDescription = buildCaseDescription({
      ...form,
      whatHappened: trimmedNarrative,
    });

    try {
      let caseId: string | null = null;

      try {
        const caseResponse = await fetch("/api/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildCasePayload({ ...form, whatHappened: trimmedNarrative })),
        });

        if (caseResponse.ok) {
          const createdCase: CreatedCaseResponse = await caseResponse.json();
          caseId = typeof createdCase.id === "string" ? createdCase.id : null;
        }
      } catch {
        caseId = null;
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...form,
          whatHappened: trimmedNarrative,
          custodyDuration: form.custodyStatus,
          caseId 
        }),
      });

      const data: AnalyzeResponse = await response.json();

      if (!response.ok || data.success === false || !data.analysis) {
        throw new Error(data.error || "Unable to analyze this case right now.");
      }

      sessionStorage.setItem(
        "jurisight_analysis",
        JSON.stringify({
          caseId,
          caseDescription,
          analysis: data.analysis,
        }),
      );
      saveCaseHistoryEntry(form, data, caseId);

      router.push("/dashboard/analysis");
    } catch (submissionError) {
      setSubmitError(
        submissionError instanceof Error ? submissionError.message : "Unable to analyze this case right now.",
      );
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <DashboardShell>
        <main className="w-full flex-1 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <Button asChild variant="ghost" size="sm" className="w-fit pl-0">
              <Link href="/dashboard">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Back to dashboard
              </Link>
            </Button>
            <div className="rounded-3xl border border-border/50 bg-bg-card p-10 shadow-panel">
              <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
                  <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-accent" />
                </div>
                <h1 className="text-2xl font-semibold text-text-primary">Analyzing your case</h1>
                <p className="mt-3 text-sm leading-6 text-text-secondary">
                  We are reviewing the facts, legal sections, risk factors, and likely precedents for this matter.
                </p>
              </div>
            </div>
          </div>
        </main>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <main className="w-full flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-8">
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
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Case Intake</p>
              <h1 className="mt-3 text-3xl font-semibold text-text-primary">Analyze a new matter</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
                Enter the core facts in a structured format. JuriSight will combine them into a single case summary and run a full analysis.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-accent/25 bg-accent/10 px-5 py-4 text-sm leading-6 text-text-primary">
            This analysis is for legal research and internal review. Confirm all conclusions against the applicable statute, court orders, and current procedural posture.
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Matter & Allegations */}
            <section className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-text-primary">Matter overview &amp; charges</h2>
                <p className="mt-1 text-sm text-text-secondary">Capture the core narrative and statutory provisions for analysis.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-sm font-medium text-text-primary">Case title <span className="text-text-secondary">(optional)</span></span>
                  <input
                    value={form.caseTitle}
                    onChange={(event) => updateField("caseTitle", event.target.value)}
                    className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    placeholder="State vs. Example Matter"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Statutory sections / offences <span className="text-text-secondary">(optional)</span></span>
                  <input
                    value={form.sections}
                    onChange={(event) => updateField("sections", event.target.value)}
                    className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    placeholder="e.g. IPC Section 420, 468 or BNS 316"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Offense classification</span>
                  <select
                    value={form.offenseType}
                    onChange={(event) => updateField("offenseType", event.target.value)}
                    className="form-select h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                  >
                    <option value="">Select offense classification...</option>
                    <option value="Non-bailable">Non-bailable</option>
                    <option value="Bailable">Bailable</option>
                    <option value="Economic Offence">Economic Offence</option>
                    <option value="Special Act (NDPS / PMLA / UAPA)">Special Act (NDPS / PMLA / UAPA)</option>
                    <option value="Under investigation / Unspecified">Under investigation / Unspecified</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-sm font-medium text-text-primary">What happened <span className="text-accent">(required)</span></span>
                  <textarea
                    value={form.whatHappened}
                    onChange={(event) => updateField("whatHappened", event.target.value)}
                    rows={7}
                    className={`rounded-2xl border bg-bg-primary px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:ring-4 ${
                      error ? "border-state-error/60 focus:border-state-error focus:ring-state-error/10" : "border-border/50 focus:border-accent focus:ring-accent/10"
                    }`}
                    placeholder="Describe the incident, factual allegations, timeline, police action, and specific events."
                  />
                  {error ? <p className="text-sm text-state-error">{error}</p> : null}
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">When did it happen <span className="text-text-secondary">(optional)</span></span>
                  <input
                    value={form.incidentDate}
                    onChange={(event) => updateField("incidentDate", event.target.value)}
                    className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    placeholder="Date, period, or sequence of events"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Where did it happen / Jurisdiction <span className="text-text-secondary">(optional)</span></span>
                  <input
                    value={form.incidentLocation}
                    onChange={(event) => updateField("incidentLocation", event.target.value)}
                    className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    placeholder="City, district, police station, or court jurisdiction"
                  />
                </label>
              </div>
            </section>

            {/* Section 2: Accused & Parties */}
            <section className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-text-primary">Accused &amp; parties involved</h2>
                <p className="mt-1 text-sm text-text-secondary">Capture details of the accused person, prior criminal history, and involved parties.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Primary accused name <span className="text-text-secondary">(optional)</span></span>
                  <input
                    value={form.accusedName}
                    onChange={(event) => updateField("accusedName", event.target.value)}
                    className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    placeholder="e.g. Ramesh Kumar"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Prior criminal record</span>
                  <select
                    value={form.priorRecord === null ? "" : form.priorRecord ? "yes" : "no"}
                    onChange={(event) => updateField("priorRecord", event.target.value === "" ? null : event.target.value === "yes")}
                    className="form-select h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                  >
                    <option value="">Select prior criminal record...</option>
                    <option value="no">No prior criminal record (First-time offender)</option>
                    <option value="yes">Has prior criminal record / convictions</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-sm font-medium text-text-primary">Accused profile &amp; community ties <span className="text-text-secondary">(optional)</span></span>
                  <input
                    value={form.accusedProfile}
                    onChange={(event) => updateField("accusedProfile", event.target.value)}
                    className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    placeholder="e.g. Business owner, permanent local resident with dependent family, no flight risk"
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-sm font-medium text-text-primary">Other parties involved <span className="text-text-secondary">(optional)</span></span>
                  <textarea
                    value={form.partiesInvolved}
                    onChange={(event) => updateField("partiesInvolved", event.target.value)}
                    rows={3}
                    className="rounded-2xl border border-border/50 bg-bg-primary px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    placeholder="Complainant, witnesses, investigating officer, institutions involved..."
                  />
                </label>
              </div>
            </section>

            {/* Section 3: Procedural Posture & Bail Posture */}
            <section className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-text-primary">Procedural posture &amp; bail factors</h2>
                <p className="mt-1 text-sm text-text-secondary">Capture the bail application type, custody status, prior bail history, and cooperation level.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Bail type sought</span>
                  <select
                    value={form.bailType}
                    onChange={(event) => updateField("bailType", event.target.value)}
                    className="form-select h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                  >
                    <option value="">Select bail type...</option>
                    <option value="Anticipatory Bail (CrPC 438)">Anticipatory Bail (CrPC 438 / Pre-arrest)</option>
                    <option value="Regular Bail (CrPC 437 / 439)">Regular Bail (CrPC 437 / 439 / In custody)</option>
                    <option value="Default / Statutory Bail (CrPC 167(2))">Default / Statutory Bail (CrPC 167(2))</option>
                    <option value="Interim Bail">Interim Bail</option>
                    <option value="Merits / General Bail Review">Merits / General Bail Review</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Current procedural stage <span className="text-text-secondary">(optional)</span></span>
                  <input
                    value={form.proceduralStage}
                    onChange={(event) => updateField("proceduralStage", event.target.value)}
                    className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    placeholder="e.g. Investigation pending, Notice u/s 41A issued, Charge sheet filed"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Custody status / duration</span>
                  <select
                    value={form.custodyStatus}
                    onChange={(event) => updateField("custodyStatus", event.target.value)}
                    className="form-select h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                  >
                    <option value="">Select custody status...</option>
                    <option value="Not arrested / Pre-arrest">Not arrested / Pre-arrest</option>
                    <option value="Under 30 days in custody">Under 30 days in custody</option>
                    <option value="1 to 6 months in custody">1 to 6 months in custody</option>
                    <option value="Over 6 months in custody">Over 6 months in custody</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Prior bail applications</span>
                  <select
                    value={form.previousBail}
                    onChange={(event) => updateField("previousBail", event.target.value)}
                    className="form-select h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                  >
                    <option value="">Select prior bail history...</option>
                    <option value="No prior bail application">No prior bail application (First time)</option>
                    <option value="Previous application rejected / dismissed">Previous application rejected / dismissed</option>
                    <option value="Bail granted and cancelled">Bail granted and cancelled</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-sm font-medium text-text-primary">Cooperation with investigation</span>
                  <select
                    value={form.cooperationLevel}
                    onChange={(event) => updateField("cooperationLevel", event.target.value)}
                    className="form-select h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                  >
                    <option value="">Select cooperation status...</option>
                    <option value="Cooperated in investigation">Cooperated in investigation (Notice complied with / Joined probe)</option>
                    <option value="Fully cooperative">Fully cooperative</option>
                    <option value="Pending / Subpoena issued">Pending / Subpoena issued</option>
                    <option value="Non-cooperative / Evading summons">Non-cooperative / Evading summons</option>
                    <option value="Not applicable">Not applicable</option>
                  </select>
                </label>
              </div>
            </section>

            {/* Section 4: Evidence & Concerns */}
            <section className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-text-primary">Evidence &amp; legal concerns</h2>
                <p className="mt-1 text-sm text-text-secondary">Include documents, proof, and specific questions or defense concerns you want reviewed.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Evidence or documents <span className="text-text-secondary">(optional)</span></span>
                  <textarea
                    value={form.evidenceDetails}
                    onChange={(event) => updateField("evidenceDetails", event.target.value)}
                    rows={5}
                    className="rounded-2xl border border-border/50 bg-bg-primary px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    placeholder="Contracts, call records, FIR copy, medical report, notice, screenshots, bank trail, CCTV, witness statements, or missing records."
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Questions or concerns <span className="text-text-secondary">(optional)</span></span>
                  <textarea
                    value={form.legalQuestions}
                    onChange={(event) => updateField("legalQuestions", event.target.value)}
                    rows={5}
                    className="rounded-2xl border border-border/50 bg-bg-primary px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                    placeholder="Mention urgency, likely offences, bail concern, evidence weakness, procedural defects, or precedent search needs."
                  />
                </label>
              </div>
            </section>

            {submitError ? (
              <div className="rounded-2xl border border-state-error/25 bg-state-error/10 px-5 py-4 text-sm text-state-error">
                <p>{submitError}</p>
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  className="mt-3"
                >
                  Retry Analysis
                </Button>
              </div>
            ) : null}

            {!submitError && (
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
              >
                Analyze Case
              </Button>
            )}
          </form>
        </div>
      </main>
    </DashboardShell>
  );
}

function IntakePageFallback() {
  return (
    <DashboardShell>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-border border-t-accent" />
      </main>
    </DashboardShell>
  );
}

export default function AnalyzeIntakePage() {
  return (
    <Suspense fallback={<IntakePageFallback />}>
      <AnalyzeIntakeContent />
    </Suspense>
  );
}
