"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type QuickCheckResult = {
  eligibilityStatus: "LIKELY_ELIGIBLE" | "BORDERLINE" | "LIKELY_INELIGIBLE";
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  reasoning: string;
  positiveFactors: string[];
  negativeFactors: string[];
  suggestedConditions: string[];
  legalBasis: string;
};

const eligibilityVariant = {
  LIKELY_ELIGIBLE: "success",
  BORDERLINE: "warning",
  LIKELY_INELIGIBLE: "error",
} as const;

function isQuickCheckResult(value: unknown): value is QuickCheckResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<QuickCheckResult>;
  return (
    typeof candidate.eligibilityStatus === "string" &&
    typeof candidate.confidenceLevel === "string" &&
    typeof candidate.reasoning === "string" &&
    Array.isArray(candidate.positiveFactors) &&
    Array.isArray(candidate.negativeFactors) &&
    Array.isArray(candidate.suggestedConditions) &&
    typeof candidate.legalBasis === "string"
  );
}

export default function QuickCheckPage() {
  const [accusedName, setAccusedName] = useState("");
  const [sections, setSections] = useState("");
  const [offenseType, setOffenseType] = useState("");
  const [priorRecord, setPriorRecord] = useState(false);
  const [jurisdiction, setJurisdiction] = useState("");
  const [result, setResult] = useState<QuickCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/quick-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accusedName,
          sections,
          offenseType,
          priorRecord,
          jurisdiction,
        }),
      });

      const data = (await res.json().catch(() => null)) as QuickCheckResult | { error?: string } | null;

      if (!res.ok || !isQuickCheckResult(data)) {
        setResult(null);
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "Assessment failed";
        setError(message);
        return;
      }

      setResult(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg-primary px-4 py-16 text-text-primary">
      <div className="mx-auto max-w-[480px] space-y-8">
        <div className="space-y-3 text-center">
          <h1 className="font-display text-4xl font-semibold tracking-tight">Quick eligibility check</h1>
          <p className="text-sm leading-7 text-text-secondary">
            Get an instant bail eligibility assessment. No account needed.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-bg-secondary/45 p-6">
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Accused name</label>
            <Input value={accusedName} onChange={(event) => setAccusedName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">FIR / case sections</label>
            <Input
              value={sections}
              onChange={(event) => setSections(event.target.value)}
              placeholder="e.g. IPC 420, 467"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Offense type</label>
            <Input
              value={offenseType}
              onChange={(event) => setOffenseType(event.target.value)}
              placeholder="e.g. Financial fraud"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Prior criminal record</label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={priorRecord ? "default" : "outline"} onClick={() => setPriorRecord(true)}>
                Yes
              </Button>
              <Button type="button" variant={!priorRecord ? "default" : "outline"} onClick={() => setPriorRecord(false)}>
                No
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Jurisdiction</label>
            <Input
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value)}
              placeholder="e.g. Delhi Sessions Court"
            />
          </div>

          {error ? <p className="text-sm text-state-error">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Checking..." : "Check eligibility ->"}
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          Want to save this assessment and generate a bail application?{" "}
          <Link href={"/sign-up" as Route} className="text-accent-gold underline underline-offset-4">
            {"Sign up free ->"}
          </Link>
        </p>

        {result ? (
          <div className="space-y-5 rounded-2xl bg-bg-secondary/45 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={eligibilityVariant[result.eligibilityStatus]}>
                {result.eligibilityStatus.replaceAll("_", " ")}
              </Badge>
              <Badge variant="gold">Confidence {result.confidenceLevel}</Badge>
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-2xl font-semibold tracking-tight">Assessment</h2>
              <p className="text-sm leading-7 text-text-secondary">{result.reasoning}</p>
              <p className="text-sm leading-7 text-text-secondary">{result.legalBasis}</p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-text-primary">Key positive factors</h3>
                <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                  {result.positiveFactors.map((factor) => (
                    <li key={factor}>- {factor}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-text-primary">Key negative factors</h3>
                <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                  {result.negativeFactors.map((factor) => (
                    <li key={factor}>- {factor}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-text-primary">Suggested bail conditions</h3>
                <ul className="mt-2 space-y-2 text-sm text-text-secondary">
                  {result.suggestedConditions.map((condition) => (
                    <li key={condition}>- {condition}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl bg-accent-gold/10 p-4">
              <p className="text-sm text-text-primary">
                Sign up to download this report as PDF and generate a full bail application.
              </p>
              <Button asChild className="mt-3">
                <Link href={"/sign-up" as Route}>Sign Up</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
