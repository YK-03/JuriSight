"use client";

import { useEffect, useState } from "react";
import type { Precedent } from "@/lib/precedents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CasePrecedents({ caseId }: { caseId: string }) {
  const [items, setItems] = useState<Precedent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch("/api/precedents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId }),
        });
        const data = (await res.json().catch(() => null)) as { precedents?: Precedent[]; error?: string } | null;

        if (!res.ok || !Array.isArray(data?.precedents)) {
          throw new Error(data?.error || "Failed to fetch precedents");
        }

        if (mounted) setItems(data.precedents);
      } catch (requestError) {
        if (mounted) {
          setError(requestError instanceof Error ? requestError.message : "Failed to fetch precedents");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [caseId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>SIMILAR PRECEDENTS</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading
          ? [1, 2, 3].map((n) => (
              <div key={n} className="h-20 animate-pulse rounded-lg border border-border bg-bg-secondary" />
            ))
          : error
            ? <p className="text-sm text-state-error">{error}</p>
            : items?.map((item, index) => (
              <div key={`${item.case}-${index}`} className="rounded-lg border border-border bg-bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={item.searchLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-text-primary underline decoration-accent/40 underline-offset-4 hover:text-accent"
                  >
                    {item.case}
                  </a>
                  <span className="rounded border border-accent/30 bg-accent/10 px-2 py-1 font-mono text-[11px] text-accent">
                    View Source
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{item.principle}</p>
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
