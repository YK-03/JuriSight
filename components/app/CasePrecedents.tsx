"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Precedent = {
  caseName: string;
  court: string;
  year: number;
  outcome: "BAIL_GRANTED" | "BAIL_DENIED";
  reason: string;
};

export function CasePrecedents({ caseId }: { caseId: string }) {
  const [items, setItems] = useState<Precedent[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/precedents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId }),
        });
        const data = (await res.json()) as { precedents: Precedent[] };
        if (mounted) setItems(data.precedents);
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
          ? [1, 2, 3].map((n) => <div key={n} className="h-20 animate-pulse rounded-lg border border-border bg-bg-secondary" />)
          : items?.map((item) => (
              <div key={`${item.caseName}-${item.year}`} className="flex gap-4 rounded-lg border border-[#E3E8EF] bg-white p-4">
                <div
                  className={item.outcome === "BAIL_GRANTED"
                    ? "h-fit rounded bg-[#D1FAE5] px-2 py-1 font-mono text-[11px] text-[#065F46]"
                    : "h-fit rounded bg-[#FEE2E2] px-2 py-1 font-mono text-[11px] text-[#991B1B]"}
                >
                  {item.outcome === "BAIL_GRANTED" ? "GRANTED" : "DENIED"}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0A2540]">{item.caseName}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase text-[#8898AA]">{item.court} | {item.year}</p>
                  <p className="mt-2 text-[13px] text-[#425466]">{item.reason}</p>
                </div>
                <div className="font-mono text-xl text-[#E3E8EF]">{item.year}</div>
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
