"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function GenerateApplicationButton({ caseId }: { caseId?: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  async function handleGenerate() {
    if (!caseId) return;
    setLoading(true);
    setMessage(null);
    setMissing([]);

    try {
      const response = await fetch(`/api/cases/${caseId}/bail-application`, { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string; missing?: string[] };
        setMessage(payload.error || "The document could not be generated.");
        setMissing(payload.missing || []);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `juriSight-bail-application-${caseId}.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Working draft downloaded.");
    } catch {
      setMessage("The document could not be generated. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={handleGenerate} loading={loading} disabled={!caseId}>
        Generate bail application draft
      </Button>
      {message && <p className="max-w-xs text-right text-xs text-text-secondary">{message}</p>}
      {missing.length > 0 && (
        <div className="max-w-xs text-right text-xs text-text-secondary">
          <p>Missing: {missing.join(", ")}.</p>
          <Link className="text-accent underline underline-offset-2" href="/dashboard/analyze">
            Return to case intake
          </Link>
        </div>
      )}
    </div>
  );
}

