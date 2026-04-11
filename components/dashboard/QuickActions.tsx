"use client";

import { ActionCard } from "./ActionCard";
import { useRouter } from "next/navigation";

export function QuickActions() {
  const router = useRouter();

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ActionCard
          title="Analyze Case"
          description="Evaluate merits, risks, and precedents."
          href="/dashboard/analyze"
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M12 3v18" />
              <path d="M5 7h14" />
              <path d="M7 7c0 3-2 5-2 5s-2-2-2-5" />
              <path d="M21 7c0 3-2 5-2 5s-2-2-2-5" />
              <path d="M8 19h8" />
            </svg>
          }
        />
        <ActionCard
          title="Check Eligibility"
          description="Verify timelines, jurisdictions, and rules."
          onClick={() => router.push("/dashboard/bail-strategy")}
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M9 3h6" />
              <path d="M10 6h4" />
              <rect x="5" y="4" width="14" height="17" rx="2" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          }
        />
      </div>
    </div>
  );
}
