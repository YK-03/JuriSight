import type { Case } from "@prisma/client";

const fields: { label: string; key: keyof Case | ((c: Case) => string) }[] = [
  { label: "Accused", key: "accusedName" },
  { label: "Section", key: "section" },
  { label: "Offense Type", key: "offenseType" },
  { label: "Jurisdiction", key: "jurisdiction" },
  { label: "Profile", key: "accusedProfile" },
  { label: "Cooperation", key: "cooperationLevel" },
  {
    label: "Prior Record",
    key: (c) => (c.priorRecord ? "Yes" : "No"),
  },
  {
    label: "Legal Framework",
    key: (c) => c.legalFramework ?? "—",
  },
  {
    label: "Date of Arrest",
    key: (c) =>
      c.dateOfArrest
        ? new Date(c.dateOfArrest).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—",
  },
  {
    label: "Filed",
    key: (c) =>
      new Date(c.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
  },
];

export function CaseInfoCard({ caseData }: { caseData: Case }) {
  return (
    <div className="animate-fade-in rounded-xl border border-border bg-bg-card p-6 shadow-panel md:p-8">
      {/* Title row */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary">
            Case File
          </p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">
            {caseData.title}
          </h1>
        </div>
        <span className="inline-flex h-fit items-center gap-1.5 rounded-md border border-accent-gold/30 bg-accent-gold/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-accent-gold">
          <span className="inline-block h-2 w-2 rounded-full bg-accent-gold" />
          {caseData.status}
        </span>
      </div>

      {/* Info grid */}
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(({ label, key }) => {
          const value =
            typeof key === "function" ? key(caseData) : String(caseData[key] ?? "—");
          return (
            <div key={label}>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-secondary">
                {label}
              </p>
              <p className="mt-0.5 text-sm font-medium text-text-primary">
                {value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Offense description */}
      {caseData.offenseDescription && (
        <div className="mt-6 rounded-lg border border-border bg-bg-primary/50 p-4">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-secondary">
            Offense Description
          </p>
          <p className="text-sm leading-relaxed text-text-primary/80">
            {caseData.offenseDescription}
          </p>
        </div>
      )}

      {/* Special act */}
      {caseData.specialAct && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-state-warning/10 px-3 py-1.5 text-xs font-medium text-state-warning">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          Special Act: {caseData.specialAct}
        </div>
      )}
    </div>
  );
}
