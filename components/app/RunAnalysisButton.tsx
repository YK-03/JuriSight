"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RunAnalysisButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <Button
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ caseId }),
            });

            if (!res.ok) {
              const data = (await res.json().catch(() => null)) as { error?: string } | null;
              setError(data?.error ?? "Analysis failed");
              return;
            }
            router.refresh();
          });
        }}
        disabled={isPending}
      >
        {isPending ? "Running Analysis..." : "Run Analysis"}
      </Button>
      {error ? <p className="text-sm text-state-error">{error}</p> : null}
    </div>
  );
}