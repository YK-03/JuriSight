"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type CaseRowProps = {
  caseItem: {
    id: string;
    title: string;
    section: string;
    status: "PENDING" | "ANALYZED" | "CLOSED";
    createdAt: Date;
    analysis: {
      flightRisk: "LOW" | "MEDIUM" | "HIGH";
      eligibilityStatus: "LIKELY_ELIGIBLE" | "LIKELY_INELIGIBLE" | "BORDERLINE";
    } | null;
  };
};

const statusStyles = {
  PENDING: "bg-state-warning/10 text-state-warning",
  ANALYZED: "bg-state-success/10 text-state-success",
  CLOSED: "bg-bg-primary text-text-secondary",
} as const;

const eligibilityStyles = {
  LIKELY_ELIGIBLE: "bg-state-success/10 text-state-success",
  BORDERLINE: "bg-state-warning/10 text-state-warning",
  LIKELY_INELIGIBLE: "bg-state-error/10 text-state-error",
  NONE: "bg-bg-primary text-text-secondary",
} as const;

export function CaseRow({ caseItem }: CaseRowProps) {
  const eligibilityLabel = caseItem.analysis?.eligibilityStatus.replaceAll("_", " ") ?? "Not analyzed";
  const eligibilityClass = caseItem.analysis
    ? eligibilityStyles[caseItem.analysis.eligibilityStatus]
    : eligibilityStyles.NONE;
  const createdAt = new Date(caseItem.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <tr className="border-t border-border/60 text-sm">
      <td className="px-4 py-4 font-medium text-text-primary">
        <Link href={`/cases/${caseItem.id}`} className="hover:text-accent-gold">
          {caseItem.title}
        </Link>
      </td>
      <td className="px-4 py-4 text-text-secondary">{caseItem.section}</td>
      <td className="px-4 py-4">
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em]",
            statusStyles[caseItem.status],
          )}
        >
          {caseItem.status}
        </span>
      </td>
      <td className="px-4 py-4">
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em]",
            eligibilityClass,
          )}
        >
          {eligibilityLabel}
        </span>
      </td>
      <td className="px-4 py-4 text-text-secondary">{createdAt}</td>
    </tr>
  );
}
