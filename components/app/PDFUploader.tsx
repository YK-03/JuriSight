"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function PDFUploader({ caseId }: { caseId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const upload = () => {
    if (!file) return;
    setMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("caseId", caseId);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setMessage(data?.error ?? "Upload failed");
        return;
      }

      setMessage("Document uploaded and parsed.");
      setFile(null);
    });
  };

  return (
    <div className="rounded-md border border-dashed border-border p-4">
      <div className="grid gap-3">
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-text-secondary file:mr-4 file:rounded file:border-0 file:bg-accent-gold file:px-3 file:py-2 file:text-sm file:font-medium file:text-bg-primary"
        />
        <Button type="button" onClick={upload} disabled={!file || isPending}>
          {isPending ? "Uploading..." : "Upload PDF"}
        </Button>
        {message ? <p className="text-sm text-text-secondary">{message}</p> : null}
      </div>
    </div>
  );
}