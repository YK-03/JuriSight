"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";

type GuestFormData = {
  section: string;
  offenseType: string;
  accusedProfile: string;
  priorRecord: string;
  cooperationLevel: string;
  offenseDescription: string;
};

type GuestAnalysisResult = {
  eligibilityStatus: "LIKELY_ELIGIBLE" | "LIKELY_INELIGIBLE" | "BORDERLINE";
  riskScore: number;
  reasoning: string;
  riskFactors: {
    flightRisk: "LOW" | "MEDIUM" | "HIGH";
    evidenceTampering: "LOW" | "MEDIUM" | "HIGH";
    communityTies: "WEAK" | "MODERATE" | "STRONG";
    offenseSeverity: "LOW" | "MODERATE" | "HIGH" | "SEVERE";
  };
  suggestedConditions: string[];
};

function outcomeMeta(status: GuestAnalysisResult["eligibilityStatus"]) {
  if (status === "LIKELY_ELIGIBLE") {
    return { label: "Bail Recommended", color: "text-state-success" };
  }
  if (status === "BORDERLINE") {
    return { label: "Conditional Bail", color: "text-state-warning" };
  }
  return { label: "Bail Not Recommended", color: "text-state-error" };
}

function riskColor(score: number) {
  if (score <= 3) return "#0E9F6E";
  if (score <= 6) return "#D97706";
  return "#DC2626";
}

const initialFormData: GuestFormData = {
  section: "S.437 - Non-Bailable Offense",
  offenseType: "Theft",
  accusedProfile: "First-time Offender",
  priorRecord: "None",
  cooperationLevel: "Fully Cooperative",
  offenseDescription: "",
};

export default function GuestPage() {
  const [formData, setFormData] = useState<GuestFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GuestAnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [readMore, setReadMore] = useState(false);

  const displayedReasoning = useMemo(() => {
    if (!result) return "";
    if (readMore || result.reasoning.length <= 200) return result.reasoning;
    return `${result.reasoning.slice(0, 200)}...`;
  }, [readMore, result]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/guest-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.status === 429) {
        setError("You have reached the guest limit (3 checks/hour). Please create a free account for unlimited access.");
        return;
      }

      if (!res.ok) throw new Error("Analysis failed");

      const data = (await res.json()) as GuestAnalysisResult;
      setResult(data);
      setReadMore(false);

      setTimeout(() => {
        document.getElementById("result-panel")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const outcome = result ? outcomeMeta(result.eligibilityStatus) : null;

  const selectClasses =
    "w-full h-[42px] rounded-lg border border-border bg-bg-card px-3 text-sm text-text-primary transition-colors focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold/40";

  return (
    <main className="min-h-screen bg-bg-primary">
      <div className="mx-auto max-w-[680px] px-6 py-16">
        {/* Header */}
        <div className="mb-10 text-center">
          <Link
            href="/"
            className="text-[13px] font-medium text-accent-gold transition-colors hover:text-accent-gold/80"
          >
            ← Back to JuriSight
          </Link>
          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.1em] text-text-secondary">
            Guest Eligibility Check
          </p>
          <h1 className="mt-2.5 text-[28px] font-bold leading-tight text-text-primary">
            Check bail eligibility instantly
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">
            No account needed. Enter case details below and get an AI-powered bail eligibility assessment in seconds.
          </p>
        </div>

        {/* Guest mode notice */}
        <div className="mb-7 rounded-lg border border-state-warning/30 bg-state-warning/8 px-4 py-3.5">
          <p className="text-[13px] font-medium text-state-warning">Guest Mode</p>
          <p className="mt-1 text-[13px] text-text-secondary">
            This is a demo assessment. Results are for informational purposes only and do not constitute legal advice. Sign up for full access, case history, and PDF exports.
          </p>
        </div>

        {!result ? (
          /* ── Form Card ──────────────────────────────────────────── */
          <div className="rounded-xl border border-border bg-bg-card p-8 shadow-panel">
            <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
              {/* CrPC Section */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-primary">
                  CrPC Section
                </label>
                <select
                  required
                  value={formData.section}
                  onChange={(e) => setFormData((prev) => ({ ...prev, section: e.target.value }))}
                  className={selectClasses}
                >
                  <option>S.436 - Bailable Offense</option>
                  <option>S.437 - Non-Bailable Offense</option>
                  <option>S.438 - Anticipatory Bail</option>
                  <option>S.439 - High Court Bail</option>
                </select>
              </div>

              {/* Offense Type */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-primary">
                  Offense Type
                </label>
                <select
                  required
                  value={formData.offenseType}
                  onChange={(e) => setFormData((prev) => ({ ...prev, offenseType: e.target.value }))}
                  className={selectClasses}
                >
                  <option>Theft</option>
                  <option>Assault</option>
                  <option>Fraud</option>
                  <option>Drug Offense</option>
                  <option>Cybercrime</option>
                  <option>Murder</option>
                  <option>Kidnapping</option>
                  <option>Other</option>
                </select>
              </div>

              {/* Accused Profile */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-primary">
                  Accused Profile
                </label>
                <select
                  required
                  value={formData.accusedProfile}
                  onChange={(e) => setFormData((prev) => ({ ...prev, accusedProfile: e.target.value }))}
                  className={selectClasses}
                >
                  <option>First-time Offender</option>
                  <option>Repeat Offender</option>
                  <option>Juvenile</option>
                  <option>Senior Citizen</option>
                </select>
              </div>

              {/* Prior Record */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-primary">
                  Prior Criminal Record
                </label>
                <select
                  required
                  value={formData.priorRecord}
                  onChange={(e) => setFormData((prev) => ({ ...prev, priorRecord: e.target.value }))}
                  className={selectClasses}
                >
                  <option>None</option>
                  <option>Minor Offenses</option>
                  <option>Major Offenses</option>
                </select>
              </div>

              {/* Cooperation Level */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-primary">
                  Cooperation Level
                </label>
                <select
                  required
                  value={formData.cooperationLevel}
                  onChange={(e) => setFormData((prev) => ({ ...prev, cooperationLevel: e.target.value }))}
                  className={selectClasses}
                >
                  <option>Fully Cooperative</option>
                  <option>Partially Cooperative</option>
                  <option>Non-Cooperative</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-primary">
                  Brief Description
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Briefly describe the offense circumstances..."
                  value={formData.offenseDescription}
                  onChange={(e) => setFormData((prev) => ({ ...prev, offenseDescription: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg-card px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 transition-colors focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold/40"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-gold px-5 py-3.5 text-[15px] font-semibold text-bg-primary transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-80"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Check Eligibility →"
                )}
              </button>

              {/* Error */}
              {error ? (
                <div className="rounded-md border border-state-error/30 bg-state-error/8 px-3.5 py-2.5 text-[13px] text-state-error">
                  {error}
                </div>
              ) : null}
            </form>
          </div>
        ) : (
          /* ── Result Panel ───────────────────────────────────────── */
          <section
            id="result-panel"
            className="mt-6 animate-fade-in rounded-xl border border-border bg-bg-card p-7 shadow-panel"
          >
            {/* Verdict header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                  Eligibility Assessment
                </p>
                <p className={`mt-1.5 text-[22px] font-bold ${outcome?.color}`}>
                  {outcome?.label}
                </p>
              </div>
              <div className="text-center">
                <div
                  className="grid h-16 w-16 place-items-center rounded-full"
                  style={{ border: `3px solid ${riskColor(result.riskScore)}` }}
                >
                  <span className="text-lg font-bold text-text-primary">
                    {result.riskScore}/10
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-[9px] uppercase tracking-widest text-text-secondary">
                  Risk
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="my-4 h-px bg-border" />

            {/* Reasoning */}
            <p className="text-sm leading-7 text-text-secondary">
              {displayedReasoning}
              {result.reasoning.length > 200 ? (
                <button
                  type="button"
                  onClick={() => setReadMore((prev) => !prev)}
                  className="ml-2 border-none bg-transparent text-accent-gold transition-colors hover:text-accent-gold/80"
                >
                  {readMore ? "Show less" : "Read more"}
                </button>
              ) : null}
            </p>

            {/* Risk factor badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                `FLIGHT RISK: ${result.riskFactors.flightRisk}`,
                `EVIDENCE TAMPERING: ${result.riskFactors.evidenceTampering}`,
                `COMMUNITY TIES: ${result.riskFactors.communityTies}`,
                `OFFENSE SEVERITY: ${result.riskFactors.offenseSeverity}`,
              ].map((item) => (
                <Badge key={item} variant="outline">{item}</Badge>
              ))}
            </div>

            {/* Suggested conditions */}
            {result.eligibilityStatus !== "LIKELY_INELIGIBLE" && result.suggestedConditions.length > 0 ? (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                  Suggested Conditions
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.suggestedConditions.map((condition) => (
                    <span
                      key={condition}
                      className="rounded-full border border-state-success/40 bg-state-success/10 px-3.5 py-1.5 text-[13px] font-medium text-state-success"
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* CTA */}
            <div className="mt-5 rounded-lg border border-accent-gold/20 bg-accent-gold/8 px-5 py-4">
              <p className="text-sm font-medium text-text-primary">
                Want to save this result, access case history, and generate a formal bail application?
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  href="/sign-up"
                  className="rounded-lg bg-accent-gold px-5 py-2.5 text-sm font-semibold text-bg-primary no-underline transition-all hover:brightness-110"
                >
                  Create Free Account
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setError("");
                    setReadMore(false);
                    setFormData(initialFormData);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="rounded-lg border border-accent-gold/50 bg-transparent px-5 py-2.5 text-sm font-medium text-accent-gold transition-colors hover:bg-accent-gold/10"
                >
                  Try Another Case
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
