import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getOrCreateUser } from "../../../../lib/user-sync";
import  db  from "../../../../lib/db";
import {
  CaseInfoCard,
  CaseActions,
  CaseTabs,
  CaseDetailSkeleton,
} from "../../../../components/app/case-detail";

export default async function CaseDetailPage({
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
    include: { analysis: true, documents: true },
  });

  if (!data) notFound();

  return (
    <Suspense fallback={<CaseDetailSkeleton />}>
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        {/* Section 1: Case Info */}
        <CaseInfoCard caseData={data} />

        {/* Section 2: Actions */}
        <CaseActions
          caseId={data.id}
          hasAnalysis={!!data.analysis}
          analysisId={data.analysis?.id}
        />

        {/* Section 3: Tabs */}
        <CaseTabs
          caseData={data}
          analysis={data.analysis}
          documents={data.documents}
        />
      </div>
    </Suspense>
  );
}
