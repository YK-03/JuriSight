import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { ArrowRight, FileText } from "lucide-react";
import { Logo } from "@/components/app/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const mockCase = {
  title: "State vs. Arjun Mehta",
  accused: "Arjun Mehta, 28",
  firNumber: "0142/2025",
  policeStation: "Lajpat Nagar",
  sections: "IPC 420, IPC 467",
  offenseType: "Cheque Fraud / Financial Forgery",
  jurisdiction: "Delhi",
  arrestDate: "12 March 2025",
  priorRecord: "No",
  cooperationLevel: "Full",
  status: "PENDING",
} as const;

const mockAnalysis = {
  eligibility: "LIKELY ELIGIBLE",
  confidence: "HIGH",
  riskScore: 3.2,
  flightRisk: "LOW",
  offenseSeverity: "MODERATE",
  recommendation:
    "Bail may be granted with standard surety conditions given the non-violent nature of the offense, full cooperation with investigation, and absence of prior criminal record.",
  positiveFactors: [
    "No prior criminal record",
    "Full cooperation with authorities",
    "Non-violent offense",
    "First-time offender",
  ],
  negativeFactors: [
    "Financial fraud carries risk of asset concealment",
    "Offense involves document forgery",
  ],
  suggestedConditions: [
    "Surrender passport",
    "Report to police station weekly",
    "Surety bond of Rs. 50,000",
  ],
  applicableSections: ["IPC 420", "IPC 467", "CrPC 437"],
  legalBasis:
    "Under CrPC Section 437, bail is permissible for non-bailable offenses when the accused is not reasonably suspected of a serious offense and poses no flight risk.",
} as const;

const mockApplication = {
  court: "Sessions Court, Delhi",
  caseNo: "SC/2025/1847",
  applicant: "Arjun Mehta",
  paragraphs: [
    "The Applicant most respectfully submits that he has been falsely implicated in the present matter arising out of FIR No. 0142/2025 registered at Police Station Lajpat Nagar under Sections 420 and 467 of the Indian Penal Code. The allegations pertain to a commercial dispute involving alleged cheque fraud and document irregularities. The Applicant is innocent, has cooperated with the investigation from the outset, and has remained available to the investigating agency whenever called upon.",
    "It is submitted that the alleged offense is documentary in nature, non-violent, and does not disclose any circumstance warranting further custodial interrogation. The Applicant has clean antecedents, is a permanent resident within the jurisdiction of this Hon'ble Court, and has deep social and family ties. There is no likelihood of absconding, tampering with evidence, or influencing witnesses, especially since the relevant records are already in the custody of the prosecution.",
    "The continued incarceration of the Applicant would serve no useful purpose and would cause irreversible harm to his liberty, livelihood, and reputation. The Applicant therefore prays that this Hon'ble Court may be pleased to enlarge him on bail on such terms and conditions as deemed fit and proper in the interests of justice.",
  ],
} as const;

const sectionLinks = [
  { href: "#case-intake", label: "Case Intake" },
  { href: "#ai-analysis", label: "AI Analysis" },
  { href: "#bail-application", label: "Bail Application" },
] as const;

function SectionShell({
  id,
  eyebrow,
  title,
  step,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  step: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-5">
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent-gold">{eyebrow}</p>
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-secondary">{step}</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}

function ListCard({ title, items, tone }: { title: string; items: readonly string[]; tone: "success" | "warning" | "gold" }) {
  const toneClass =
    tone === "success"
      ? "border-state-success/20 bg-state-success/5"
      : tone === "warning"
        ? "border-state-warning/20 bg-state-warning/5"
        : "border-accent-gold/20 bg-accent-gold/5";

  return (
    <div className={`rounded-xl border p-5 ${toneClass}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">{title}</p>
      <ul className="mt-4 space-y-3 text-sm leading-7 text-text-primary">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-current opacity-80" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function DemoPage() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);

  return (
    <main className="min-h-screen scroll-smooth bg-bg-primary text-text-primary">
      <div className="border-b border-border bg-bg-primary/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Logo href="/" compact />
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link href={"/sign-in" as Route}>Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href={"/sign-up" as Route}>Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <section className="rounded-[1.5rem] border border-neutral-200/10 bg-bg-card/80 px-6 py-8 shadow-panel">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent-gold">See How It Works</p>
              <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                A guided walkthrough of the JuriSight workflow
              </h1>
              <p className="max-w-2xl text-base leading-7 text-text-secondary">
                Follow a realistic mock matter from intake to AI analysis to a draft bail application. Everything on this page is sample data, designed to show how the platform works before you begin.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sectionLinks.map((link) => (
                <Button key={link.href} asChild variant="outline" size="sm">
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-12 space-y-16">
          <SectionShell
            id="case-intake"
            eyebrow="Workflow Overview"
            title="Mock Case Intake"
            step="Step 1 of 3 - Case Intake"
          >
            <Card className="rounded-[1.5rem] border border-neutral-200/10 bg-bg-card/90 shadow-panel">
              <CardHeader className="flex flex-col gap-4 border-b border-neutral-200/10 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-accent-gold">The Case</CardTitle>
                  <h3 className="font-display text-2xl font-semibold tracking-tight text-text-primary">{mockCase.title}</h3>
                </div>
                <Badge variant="warning">{mockCase.status}</Badge>
              </CardHeader>
              <CardContent className="grid gap-6 py-6 sm:grid-cols-2 xl:grid-cols-4">
                <DetailRow label="Accused" value={mockCase.accused} />
                <DetailRow label="FIR No." value={mockCase.firNumber} />
                <DetailRow label="Police Station" value={mockCase.policeStation} />
                <DetailRow label="Sections" value={mockCase.sections} />
                <DetailRow label="Offense Type" value={mockCase.offenseType} />
                <DetailRow label="Jurisdiction" value={mockCase.jurisdiction} />
                <DetailRow label="Date of Arrest" value={mockCase.arrestDate} />
                <DetailRow label="Prior Record" value={mockCase.priorRecord} />
                <DetailRow label="Cooperation Level" value={mockCase.cooperationLevel} />
              </CardContent>
            </Card>
          </SectionShell>

          <SectionShell
            id="ai-analysis"
            eyebrow="AI Review"
            title="Mock Bail Analysis"
            step="Step 2 of 3 - AI Analysis"
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <Card className="rounded-[1.5rem] border border-neutral-200/10 bg-bg-card/90 shadow-panel">
                <CardHeader className="border-b border-neutral-200/10">
                  <CardTitle className="text-accent-gold">Analysis Result</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 py-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="success">{mockAnalysis.eligibility}</Badge>
                    <Badge variant="gold">Confidence {mockAnalysis.confidence}</Badge>
                    <Badge variant="default">Flight Risk {mockAnalysis.flightRisk}</Badge>
                    <Badge variant="warning">Severity {mockAnalysis.offenseSeverity}</Badge>
                  </div>

                  <div className="rounded-xl border border-accent-gold/20 bg-accent-gold/5 p-5">
                    <div className="flex items-end justify-between gap-4">
                      <div className="space-y-2">
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">Risk Score</p>
                        <div className="text-4xl font-semibold tracking-tight text-text-primary">{mockAnalysis.riskScore} / 10</div>
                      </div>
                      <div className="w-full max-w-xs">
                        <div className="h-3 overflow-hidden rounded-full bg-bg-secondary">
                          <div
                            className="h-full rounded-full bg-state-success"
                            style={{ width: `${(mockAnalysis.riskScore / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">Recommendation</p>
                    <p className="text-sm leading-7 text-text-primary">{mockAnalysis.recommendation}</p>
                  </div>

                  <div className="space-y-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">Applicable Sections</p>
                    <div className="flex flex-wrap gap-2">
                      {mockAnalysis.applicableSections.map((section) => (
                        <Badge key={section} variant="outline">
                          {section}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-bg-secondary/35 p-5">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">Legal Basis</p>
                    <p className="mt-3 text-sm leading-7 text-text-secondary">{mockAnalysis.legalBasis}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6">
                <ListCard title="Positive Factors" items={mockAnalysis.positiveFactors} tone="success" />
                <ListCard title="Negative Factors" items={mockAnalysis.negativeFactors} tone="warning" />
                <ListCard title="Suggested Conditions" items={mockAnalysis.suggestedConditions} tone="gold" />
              </div>
            </div>
          </SectionShell>

          <SectionShell
            id="bail-application"
            eyebrow="Drafting Layer"
            title="Mock Bail Application Preview"
            step="Step 3 of 3 - Bail Application"
          >
            <Card className="overflow-hidden rounded-[1.5rem] border border-neutral-200/10 bg-bg-card/90 shadow-panel">
              <CardHeader className="border-b border-neutral-200/10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-accent-gold">Draft Application</CardTitle>
                    <div className="space-y-1 text-sm text-text-secondary">
                      <p>Court: {mockApplication.court}</p>
                      <p>Case No: {mockApplication.caseNo}</p>
                      <p>Applicant: {mockApplication.applicant}</p>
                    </div>
                  </div>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative px-6 py-8">
                <div className="rounded-xl border border-neutral-200/10 bg-bg-primary/40 p-6">
                  <div className="mx-auto max-w-3xl space-y-6">
                    <div className="text-center">
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-text-secondary">Before the Hon&apos;ble Sessions Court</p>
                      <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight text-text-primary">Application for Grant of Regular Bail</h3>
                    </div>
                    {mockApplication.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="text-sm leading-8 text-text-primary">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg-card via-bg-card/90 to-transparent" />
                <div className="absolute inset-x-0 bottom-8 flex justify-center px-6">
                  {isSignedIn ? (
                    <Button asChild size="lg" className="rounded-xl px-6">
                      <Link href="/dashboard">Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                  ) : (
                    <Button asChild size="lg" className="rounded-xl px-6">
                      <Link href={"/sign-up" as Route}>Sign up to generate full application <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </SectionShell>
        </div>

        <section className="mt-16 rounded-[1.5rem] border border-neutral-200/10 bg-bg-card/90 px-6 py-8 shadow-panel">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent-gold">Next Step</p>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
                Ready to analyze your first case?
              </h2>
              <p className="text-base leading-7 text-text-secondary">
                Bring in your first matter, review the intake, run AI analysis, and generate court-ready drafts inside the same workflow.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {isSignedIn ? (
                <Button asChild size="lg" className="rounded-xl px-6">
                  <Link href="/dashboard">Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="rounded-xl px-6">
                    <Link href={"/sign-up" as Route}>Get Started Free</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="rounded-xl px-6">
                    <Link href={"/sign-in" as Route}>Sign In</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
