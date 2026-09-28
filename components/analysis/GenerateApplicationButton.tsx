"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function GenerateApplicationButton({ caseId }: { caseId?: string | null }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    if (status !== "success") return;

    const timer = window.setTimeout(() => setStatus("idle"), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function handleGenerate() {
    setStatus("loading");
    setMessage(null);
    setMissing([]);

    const normalizedCaseId = typeof caseId === "string" ? caseId.trim() : "";
    if (!normalizedCaseId) {
      setMessage("This analysis is not linked to a saved case, so a working draft cannot be generated from it.");
      setStatus("idle");
      return;
    }

    try {
      const response = await fetch(`/api/cases/${normalizedCaseId}/bail-application`, { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string; missing?: string[] };
        setMessage(payload.error || "The document could not be generated.");
        setMissing(payload.missing || []);
        setStatus("idle");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `juriSight-bail-application-${normalizedCaseId}.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("success");
    } catch {
      setMessage("The document could not be generated. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={handleGenerate} disabled={status === "loading"}>
        {status === "loading" ? "Generating…" : status === "success" ? "✓ Draft downloaded" : "Generate bail application draft"}
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
