"use client";

import { RunAnalysisButton } from "../../../components/app/RunAnalysisButton";
import { BailApplicationGenerator } from "../../../components/app/BailApplicationGenerator";
import { Button } from "../../../components/ui/button";
import Link from "next/link";
import type { Route } from "next";

export function CaseActions({
  caseId,
  hasAnalysis,
  analysisId,
}: {
  caseId: string;
  hasAnalysis: boolean;
  analysisId?: string;
}) {
  return (
    <div className="animate-fade-in-1 flex flex-wrap items-center gap-3">
      {/* Primary CTA */}
      <RunAnalysisButton caseId={caseId} />

      {/* View latest analysis */}
      {hasAnalysis && analysisId && (
        <Button asChild variant="outline">
          <Link href={`/analysis/${analysisId}` as Route}>View Latest Analysis</Link>
        </Button>
      )}

      {/* Generate bail application */}
      {hasAnalysis && <BailApplicationGenerator caseId={caseId} />}
    </div>
  );
}
