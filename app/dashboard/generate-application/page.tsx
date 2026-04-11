import type { Route } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BailApplicationGenerator } from "@/components/app/BailApplicationGenerator";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-sync";

export default async function GenerateApplicationPage() {
  const user = await getOrCreateUser();

  if (!user) {
    return (
      <DashboardShell>
        <DashboardHeader />
        <main className="w-full flex-1 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-3xl border border-border/50 bg-bg-card p-8 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#B8952A]">Generate Application</p>
            <h1 className="mt-3 text-3xl font-semibold text-text-primary">Sign in required</h1>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Please sign in to access saved analyzed matters and generate a bail application draft.
            </p>
          </div>
        </main>
      </DashboardShell>
    );
  }

  const analyzedCases = await db.case.findMany({
    where: {
      userId: user.id,
      analysis: {
        isNot: null,
      },
    },
    include: {
      analysis: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 12,
  });

  return (
    <DashboardShell>
      <DashboardHeader />
      <main className="w-full flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <div className="flex flex-col gap-4">
            <Link
              href={"/dashboard/bail-strategy" as Route}
              className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-[#B8952A]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Back to bail strategy
            </Link>
            <div className="rounded-3xl border border-border/50 bg-bg-card p-8 shadow-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#B8952A]">Generate Application</p>
              <h1 className="mt-3 text-3xl font-semibold text-text-primary">Create a bail application draft from an analyzed case</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
                Select any saved matter with completed analysis. JuriSight will draft a formal bail application using the analyzed grounds and case details already on record.
              </p>
            </div>
          </div>

          {analyzedCases.length === 0 ? (
            <section className="rounded-3xl border border-border/50 bg-bg-card p-8 shadow-panel">
              <h2 className="text-xl font-semibold text-text-primary">No analyzed matters available</h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Run a full case analysis first, then come back here to generate a formal bail application draft.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={"/dashboard/analyze" as Route}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#B8952A] px-5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Analyze a Case
                </Link>
                <Link
                  href={"/dashboard" as Route}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-border/60 bg-bg-primary px-5 text-sm font-semibold text-text-primary transition hover:border-[#B8952A]/50 hover:text-[#B8952A]"
                >
                  Return to Dashboard
                </Link>
              </div>
            </section>
          ) : (
            <section className="grid gap-4">
              {analyzedCases.map((caseItem) => (
                <article key={caseItem.id} className="rounded-3xl border border-border/50 bg-bg-card p-6 shadow-panel">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">{caseItem.section}</p>
                        <h2 className="mt-2 text-xl font-semibold text-text-primary">{caseItem.title}</h2>
                      </div>
                      <div className="grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
                        <p><span className="font-medium text-text-primary">Accused:</span> {caseItem.accusedName}</p>
                        <p><span className="font-medium text-text-primary">Offense:</span> {caseItem.offenseType}</p>
                        <p><span className="font-medium text-text-primary">Jurisdiction:</span> {caseItem.jurisdiction}</p>
                        <p><span className="font-medium text-text-primary">Updated:</span> {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(caseItem.updatedAt)}</p>
                      </div>
                      <p className="max-w-3xl text-sm leading-6 text-text-secondary">{caseItem.analysis?.reasoning}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-3">
                      <BailApplicationGenerator caseId={caseItem.id} />
                      <Link
                        href={"/dashboard" as Route}
                        className="inline-flex h-10 items-center justify-center rounded-2xl border border-border/60 bg-bg-primary px-4 text-sm font-semibold text-text-primary transition hover:border-[#B8952A]/50 hover:text-[#B8952A]"
                      >
                        View Dashboard
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      </main>
    </DashboardShell>
  );
}
