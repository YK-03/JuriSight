"use client";

import type { Route } from "next";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useState } from "react";

type GuestEligibilityRequest = {
  crpcSection: string;
  offenseType: string;
  accusedProfile: string;
  priorRecord: string;
  cooperationLevel: string;
  description: string;
};

type RiskSeverity = "HIGH" | "MEDIUM" | "LOW";
type Verdict = "Bailable" | "Non-Bailable" | "Conditional Bail (Discretionary)";

type GuestEligibilityResult = {
  verdict: Verdict;
  riskScore: number;
  crpcSection: string;
  summary: string;
  riskFactors: Array<{
    label: string;
    severity: RiskSeverity;
  }>;
  oneRecommendation: string;
};

const initialFormState: GuestEligibilityRequest = {
  crpcSection: "Section 436 CrPC - Bailable offense",
  offenseType: "Theft",
  accusedProfile: "First-time offender with local residence",
  priorRecord: "No prior criminal record",
  cooperationLevel: "Fully cooperative with investigation",
  description: "",
};

function verdictClasses(verdict: Verdict) {
  if (verdict === "Bailable") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (verdict === "Non-Bailable") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function progressClasses(score: number) {
  if (score <= 40) {
    return "bg-green-500";
  }

  if (score <= 70) {
    return "bg-amber-500";
  }

  return "bg-red-500";
}

function severityClasses(severity: RiskSeverity) {
  if (severity === "HIGH") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (severity === "MEDIUM") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-green-200 bg-green-50 text-green-700";
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 animate-spin"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        className="stroke-current opacity-20"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        className="stroke-current"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
    >
      <path
        d="M4.167 10h11.666M10.833 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function GuestPage() {
  const { isSignedIn } = useUser();
  const [formData, setFormData] = useState<GuestEligibilityRequest>(initialFormState);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GuestEligibilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/guest-eligibility", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const data = (await response.json()) as GuestEligibilityResult;
      setResult(data);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const fieldClassName =
    "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100";
  const areaClassName =
    "w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100";

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <Link
            href={"/" as Route}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#C9A84C] transition hover:text-amber-600"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
              <path
                d="M15.833 10H4.167M9.167 15 4.167 10l5-5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to JuriSight
          </Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-[#C9A84C]">
            Guest Bail Eligibility
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            Check bail eligibility instantly
          </h1>
          <p className="mt-4 text-sm leading-7 text-gray-600 sm:text-base">
            Enter core case details to receive a quick bail eligibility assessment under Indian criminal procedure.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-amber-100 bg-amber-50/70 p-4">
          <p className="text-sm font-semibold text-amber-700">Public guest mode</p>
          <p className="mt-1 text-sm leading-6 text-amber-800/80">
            This assessment is informational and does not replace legal advice. Sign in to unlock the full analysis flow in your dashboard.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="crpcSection" className="mb-2 block text-sm font-medium text-gray-900">
                  CrPC Section
                </label>
                <select
                  id="crpcSection"
                  required
                  value={formData.crpcSection}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, crpcSection: event.target.value }))
                  }
                  className={fieldClassName}
                >
                  <option>Section 436 CrPC - Bailable offense</option>
                  <option>Section 437 CrPC - Non-bailable offense before Magistrate</option>
                  <option>Section 438 CrPC - Anticipatory bail</option>
                  <option>Section 439 CrPC - Special powers of High Court or Sessions Court</option>
                </select>
              </div>

              <div>
                <label htmlFor="offenseType" className="mb-2 block text-sm font-medium text-gray-900">
                  Offense Type
                </label>
                <select
                  id="offenseType"
                  required
                  value={formData.offenseType}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, offenseType: event.target.value }))
                  }
                  className={fieldClassName}
                >
                  <option>Theft</option>
                  <option>Assault</option>
                  <option>Cheating and fraud</option>
                  <option>Cyber offense</option>
                  <option>Drug offense</option>
                  <option>Domestic violence complaint</option>
                  <option>Kidnapping</option>
                  <option>Homicide allegation</option>
                </select>
              </div>

              <div>
                <label htmlFor="accusedProfile" className="mb-2 block text-sm font-medium text-gray-900">
                  Accused Profile
                </label>
                <select
                  id="accusedProfile"
                  required
                  value={formData.accusedProfile}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, accusedProfile: event.target.value }))
                  }
                  className={fieldClassName}
                >
                  <option>First-time offender with local residence</option>
                  <option>Repeat offender</option>
                  <option>Student or young adult</option>
                  <option>Senior citizen</option>
                  <option>Primary earning member with dependents</option>
                </select>
              </div>

              <div>
                <label htmlFor="priorRecord" className="mb-2 block text-sm font-medium text-gray-900">
                  Prior Record
                </label>
                <select
                  id="priorRecord"
                  required
                  value={formData.priorRecord}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, priorRecord: event.target.value }))
                  }
                  className={fieldClassName}
                >
                  <option>No prior criminal record</option>
                  <option>Minor prior allegations</option>
                  <option>Pending cases in similar category</option>
                  <option>Serious prior convictions</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="cooperationLevel" className="mb-2 block text-sm font-medium text-gray-900">
                Cooperation Level
              </label>
              <select
                id="cooperationLevel"
                required
                value={formData.cooperationLevel}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, cooperationLevel: event.target.value }))
                }
                className={fieldClassName}
              >
                <option>Fully cooperative with investigation</option>
                <option>Partially cooperative</option>
                <option>Non-cooperative or evasive</option>
              </select>
            </div>

            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-medium text-gray-900">
                Brief Description
              </label>
              <textarea
                id="description"
                rows={5}
                required
                value={formData.description}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Summarize the incident, allegations, arrest stage, and any relevant circumstances."
                className={areaClassName}
              />
            </div>

            <div className="pt-1">
              {!result ? (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent-gold/70 bg-accent-gold px-5 py-3.5 text-sm font-semibold text-bg-primary transition-all duration-300 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {isLoading ? (
                    <>
                      <Spinner />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      Check Eligibility
                      <ArrowIcon />
                    </>
                  )}
                </button>
              ) : null}
              {error ? <p className="mt-3 text-sm text-red-600">Something went wrong. Try again.</p> : null}
            </div>
          </form>
        </div>

        {result ? (
          <section className="mx-auto mt-8 max-w-3xl rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
            <div
              className={`w-full rounded-full border px-4 py-3 text-center text-sm font-semibold uppercase tracking-widest ${verdictClasses(result.verdict)}`}
            >
              {result.verdict}
            </div>

            <div className="mt-6 rounded-xl border border-gray-100 bg-stone-50 p-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                    Risk Score
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">{result.riskScore}</p>
                </div>
                <p className="text-sm text-gray-500">0 to 100</p>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all ${progressClasses(result.riskScore)}`}
                  style={{ width: `${Math.max(0, Math.min(100, result.riskScore))}%` }}
                />
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Summary</p>
              <p className="mt-3 text-sm leading-relaxed text-gray-700">{result.summary}</p>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">Risk Factors</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {result.riskFactors.map((factor) => (
                  <div
                    key={`${factor.label}-${factor.severity}`}
                    className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2"
                  >
                    <span className="text-sm font-medium text-gray-800">{factor.label}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${severityClasses(factor.severity)}`}
                    >
                      {factor.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-stone-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                  Applicable Section
                </p>
                <p className="mt-2 text-sm font-medium text-gray-900">{result.crpcSection}</p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-stone-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                  One Recommendation
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-800">{result.oneRecommendation}</p>
              </div>
            </div>

            <div className="relative mt-5 overflow-hidden rounded-xl border border-gray-100 bg-stone-50 p-4">
              <div className="space-y-3 blur-sm opacity-50">
                <div className="h-3 w-11/12 rounded-full bg-gray-300" />
                <div className="h-3 w-10/12 rounded-full bg-gray-300" />
                <div className="h-3 w-9/12 rounded-full bg-gray-300" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-white/45 text-center">
                <p className="px-6 text-sm font-semibold text-gray-800">
                  3 more recommendations - Sign in for full report
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50/70 p-4">
              {isSignedIn ? (
                <Link
                  href={"/dashboard" as Route}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#C9A84C] transition hover:text-amber-600"
                >
                  View full analysis in Dashboard
                  <ArrowIcon />
                </Link>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
                  <Link
                    href={"/sign-in" as Route}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#C9A84C] transition hover:text-amber-600"
                  >
                    Sign in to see full risk breakdown
                    <ArrowIcon />
                  </Link>
                  <Link
                    href={"/sign-up" as Route}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 transition hover:text-[#C9A84C]"
                  >
                    Create free account
                    <ArrowIcon />
                  </Link>
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
