import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getOrCreateUser } from "../../../../lib/user-sync";
import  db  from "../../../../lib/db";
import { mapPrismaAnalysis } from "../../../../lib/analysis-types";
import {
  VerdictCard,
  RiskBreakdown,
  LegalReasoning,
  PrecedentsPanel,
  BiasWarning,
  AnalysisPageSkeleton,
} from "../../../../components/app/analysis";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getOrCreateUser();
  if (!user) {
    notFound();
  }
  const userId = user.id;

  const { id } = await params;
  const data = await db.case.findFirst({
    where: { id, userId },
    include: { analysis: true },
  });

  if (!data || !data.analysis) notFound();

  const analysis = mapPrismaAnalysis(data.analysis);

  return (
    <Suspense fallback={<AnalysisPageSkeleton />}>
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        {/* Page header */}
        <div className="animate-fade-in space-y-1">
          <h1 className="font-display text-3xl font-semibold text-text-primary">
            Analysis Result
          </h1>
          <p className="text-sm text-text-secondary">
            Case: {data.title}
          </p>
        </div>

        {/* Section 1: Verdict */}
        <VerdictCard analysis={analysis} />

        {/* Section 2: Risk Breakdown */}
        <RiskBreakdown factors={analysis.riskFactors} />

        {/* Section 3: Legal Reasoning */}
        <LegalReasoning
          legalBasis={analysis.legalBasis}
          reasoning={analysis.reasoning}
          riskFactors={analysis.riskFactors}
          conditions={analysis.conditions}
          eligibility={analysis.eligibility}
        />

        {/* Section 4: Precedents */}
        <PrecedentsPanel precedents={analysis.precedents} />

        {/* Section 5: Bias Warning */}
        <BiasWarning text={analysis.biasWarning} />
      </div>
    </Suspense>
  );
}