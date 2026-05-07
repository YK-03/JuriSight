"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { AnalyzeResponse } from "@/lib/analysis-types";

type CaseHistoryStatus = "Intake" | "Analyzing" | "Action needed" | "In progress" | "Educated";

type IntakeFormState = {
  caseTitle: string;
  whatHappened: string;
  incidentDate: string;
  incidentLocation: string;
  partiesInvolved: string;
  proceduralStage: string;
  evidenceDetails: string;
  legalQuestions: string;
};

const INITIAL_FORM_STATE: IntakeFormState = {
  caseTitle: "",
  whatHappened: "",
  incidentDate: "",
  incidentLocation: "",
  partiesInvolved: "",
  proceduralStage: "",
  evidenceDetails: "",
  legalQuestions: "",
};

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

function buildCaseDescription(values: IntakeFormState): string {
  const sections = [
    values.caseTitle.trim() ? `Case title: ${values.caseTitle.trim()}` : "",
    `What happened: ${values.whatHappened.trim()}`,
    values.incidentDate.trim() ? `When it happened: ${values.incidentDate.trim()}` : "",
    values.incidentLocation.trim() ? `Where it happened: ${values.incidentLocation.trim()}` : "",
    values.partiesInvolved.trim() ? `People involved: ${values.partiesInvolved.trim()}` : "",
    values.proceduralStage.trim() ? `Current procedural stage: ${values.proceduralStage.trim()}` : "",
    values.evidenceDetails.trim() ? `Evidence or documents: ${values.evidenceDetails.trim()}` : "",
    values.legalQuestions.trim() ? `Primary questions or concerns: ${values.legalQuestions.trim()}` : "",
  ];

  return sections.filter(Boolean).join("\n\n");
}

function buildCasePayload(values: IntakeFormState) {
  const normalizedTitle =
    values.caseTitle.trim() || values.whatHappened.trim().slice(0, 60) || "Untitled case";

  return {
    title: normalizedTitle,
    accusedName: values.partiesInvolved.trim() || "Not specified",
    section: values.legalQuestions.trim() || "Pending analysis",
    offenseType: values.caseTitle.trim() || "General legal matter",
    accusedProfile: values.partiesInvolved.trim() || "Not specified",
    priorRecord: false,
    offenseDescription: values.whatHappened.trim(),
    cooperationLevel: values.proceduralStage.trim() || "Not specified",
    jurisdiction: values.incidentLocation.trim() || "Not specified",
    legalFramework: values.legalQuestions.trim() || undefined,
    specialAct: undefined,
  };
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
        <DashboardHeader />
        <main className="w-full flex-1 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-[#B8952A]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Back to dashboard
            </Link>
            <div className="rounded-3xl border border-border/50 bg-bg-card p-10 shadow-panel">
              <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#B8952A]/20 bg-[#B8952A]/10">
                  <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#B8952A]/25 border-t-[#B8952A]" />
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
      <DashboardHeader />
      <main className="w-full flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-8">
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
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#B8952A]">Case Intake</p>
              <h1 className="mt-3 text-3xl font-semibold text-text-primary">Analyze a new matter</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
                Enter the core facts in a structured format. JuriSight will combine them into a single case summary and run a full analysis.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#B8952A]/25 bg-[#B8952A]/10 px-5 py-4 text-sm leading-6 text-text-primary">
            This analysis is for legal research and internal review. Confirm all conclusions against the applicable statute, court orders, and current procedural posture.
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-text-primary">Matter overview</h2>
                <p className="mt-1 text-sm text-text-secondary">Capture the core narrative and the basic context for analysis.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-sm font-medium text-text-primary">Case title <span className="text-text-secondary">(optional)</span></span>
                  <input
                    value={form.caseTitle}
                    onChange={(event) => updateField("caseTitle", event.target.value)}
                    className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-[#B8952A] focus:ring-4 focus:ring-[#B8952A]/10"
                    placeholder="State vs. Example Matter"
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-sm font-medium text-text-primary">What happened <span className="text-[#B8952A]">(required)</span></span>
                  <textarea
                    value={form.whatHappened}
                    onChange={(event) => updateField("whatHappened", event.target.value)}
                    rows={7}
                    className={`rounded-2xl border bg-bg-primary px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:ring-4 ${
                      error ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/10" : "border-border/50 focus:border-[#B8952A] focus:ring-[#B8952A]/10"
                    }`}
                    placeholder="Describe the incident, allegations, timeline, police or court action, and any immediate legal concern."
                  />
                  {error ? <p className="text-sm text-red-500">{error}</p> : null}
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">When did it happen <span className="text-text-secondary">(optional)</span></span>
                  <input
                    value={form.incidentDate}
                    onChange={(event) => updateField("incidentDate", event.target.value)}
                    className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-[#B8952A] focus:ring-4 focus:ring-[#B8952A]/10"
                    placeholder="Date, period, or sequence of events"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Where did it happen <span className="text-text-secondary">(optional)</span></span>
                  <input
                    value={form.incidentLocation}
                    onChange={(event) => updateField("incidentLocation", event.target.value)}
                    className="h-12 rounded-2xl border border-border/50 bg-bg-primary px-4 text-sm text-text-primary outline-none transition focus:border-[#B8952A] focus:ring-4 focus:ring-[#B8952A]/10"
                    placeholder="City, district, police station, or jurisdiction"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-text-primary">People and procedure</h2>
                <p className="mt-1 text-sm text-text-secondary">Add the parties involved and the current legal stage.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Who is involved <span className="text-text-secondary">(optional)</span></span>
                  <textarea
                    value={form.partiesInvolved}
                    onChange={(event) => updateField("partiesInvolved", event.target.value)}
                    rows={4}
                    className="rounded-2xl border border-border/50 bg-bg-primary px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-[#B8952A] focus:ring-4 focus:ring-[#B8952A]/10"
                    placeholder="Accused, complainant, witnesses, employer, family members, police officials, or institutions."
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Current procedural stage <span className="text-text-secondary">(optional)</span></span>
                  <textarea
                    value={form.proceduralStage}
                    onChange={(event) => updateField("proceduralStage", event.target.value)}
                    rows={4}
                    className="rounded-2xl border border-border/50 bg-bg-primary px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-[#B8952A] focus:ring-4 focus:ring-[#B8952A]/10"
                    placeholder="FIR filed, investigation pending, charge sheet filed, summons received, trial ongoing, anticipatory bail, regular bail, etc."
                  />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-text-primary">Evidence and concerns</h2>
                <p className="mt-1 text-sm text-text-secondary">Include documents, proof, and the specific legal concerns you want reviewed.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Evidence or documents <span className="text-text-secondary">(optional)</span></span>
                  <textarea
                    value={form.evidenceDetails}
                    onChange={(event) => updateField("evidenceDetails", event.target.value)}
                    rows={5}
                    className="rounded-2xl border border-border/50 bg-bg-primary px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-[#B8952A] focus:ring-4 focus:ring-[#B8952A]/10"
                    placeholder="Contracts, call records, FIR copy, medical report, notice, screenshots, bank trail, CCTV, witness statements, or missing records."
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text-primary">Questions or concerns <span className="text-text-secondary">(optional)</span></span>
                  <textarea
                    value={form.legalQuestions}
                    onChange={(event) => updateField("legalQuestions", event.target.value)}
                    rows={5}
                    className="rounded-2xl border border-border/50 bg-bg-primary px-4 py-3 text-sm leading-6 text-text-primary outline-none transition focus:border-[#B8952A] focus:ring-4 focus:ring-[#B8952A]/10"
                    placeholder="Mention urgency, likely offences, bail concern, evidence weakness, procedural defects, or precedent search needs."
                  />
                </label>
              </div>
            </section>

            {submitError ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-4 text-sm text-red-500">
                <p>{submitError}</p>
                <button
                  type="submit"
                  className="mt-3 text-xs font-semibold uppercase tracking-wider text-red-700 underline underline-offset-4 hover:text-red-800"
                >
                  Retry Analysis
                </button>
              </div>
            ) : null}

            {!submitError && (
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#B8952A] px-5 text-sm font-semibold text-white transition hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-[#B8952A]/20"
              >
                Analyze Case
              </button>
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
      <DashboardHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#B8952A]/25 border-t-[#B8952A]" />
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
