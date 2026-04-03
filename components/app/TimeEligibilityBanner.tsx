import type { Case } from "@prisma/client";

const WarningIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)));
}

export function TimeEligibilityBanner({ data }: { data: Pick<Case, "dateOfArrest" | "maximumSentenceYears"> }) {
  if (!data.dateOfArrest || !data.maximumSentenceYears) return null;

  const timeServedDays = daysBetween(new Date(), new Date(data.dateOfArrest));
  const maxSentenceDays = data.maximumSentenceYears * 365;
  const percentServed = (timeServedDays / maxSentenceDays) * 100;
  const percentText = Math.min(999, Math.round(percentServed));

  if (percentServed < 33) return null;

  const red = percentServed >= 50;

  return (
    <div
      className={red
        ? "flex items-center gap-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-[#991B1B]"
        : "flex items-center gap-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-5 py-4 text-[#92400E]"}
    >
      <WarningIcon />
      <span className="font-mono text-xs">{percentText}%</span>
      <p className="text-sm">
        {red
          ? `Undertrial has served ${percentText}% of maximum sentence - Eligible for bail consideration under S.436A CrPC`
          : `Undertrial has served ${percentText}% of maximum sentence - Approaching S.436A threshold`}
      </p>
    </div>
  );
}
