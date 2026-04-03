"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type ExtractedDocumentData = {
  title: string;
  accusedName: string;
  accusedAge: number | null;
  firNumber: string;
  policeStation: string;
  district: string;
  state: string;
  sections: string;
  allegations: string;
  arrestDate: string;
  custodyDuration: string;
  previousConvictions: boolean;
  notes: string;
};

type DocumentUploaderProps = {
  onExtracted: (data: ExtractedDocumentData) => void;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function isExtractedDocumentData(value: unknown): value is ExtractedDocumentData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ExtractedDocumentData>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.accusedName === "string" &&
    typeof candidate.firNumber === "string" &&
    typeof candidate.sections === "string" &&
    typeof candidate.allegations === "string" &&
    typeof candidate.previousConvictions === "boolean"
  );
}

export default function DocumentUploader({ onExtracted }: DocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  const fileSummary = useMemo(() => {
    if (!file) {
      return null;
    }

    return `${file.name} - ${formatFileSize(file.size)}`;
  }, [file]);

  const acceptFile = (nextFile: File | null) => {
    setError(null);
    setStatus("idle");

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (nextFile.type !== "application/pdf") {
      setFile(null);
      setError("Only PDF files are supported.");
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("File size must be 10MB or smaller.");
      return;
    }

    setFile(nextFile);
  };

  const extract = async () => {
    if (!file) {
      setError("Choose a PDF before extracting.");
      return;
    }

    setError(null);
    setStatus("loading");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract-document", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json().catch(() => null)) as ExtractedDocumentData | { error?: string } | null;

      if (!res.ok || !isExtractedDocumentData(data)) {
        setStatus("idle");
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "Failed to extract case details.";
        setError(message);
        return;
      }

      onExtracted(data);
      setStatus("done");
    } catch {
      setStatus("idle");
      setError("Failed to extract case details.");
    }
  };

  return (
    <div className="grid gap-3 rounded-xl border border-dashed border-border bg-bg-card/40 p-4">
      <div
        className={`rounded-lg border px-4 py-5 transition ${
          isDragging ? "border-accent-gold bg-accent-gold/5" : "border-border bg-bg-secondary/35"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          acceptFile(event.dataTransfer.files?.[0] ?? null);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">Document Intake</p>
            <p className="text-sm text-text-primary">Drag and drop a FIR, charge sheet, or remand order PDF.</p>
            <p className="text-xs text-text-secondary">PDF only, up to 10MB. The file is processed in memory and not stored.</p>
          </div>
          <Button type="button" variant="ghost" onClick={() => inputRef.current?.click()}>
            Choose PDF
          </Button>
        </div>
        {fileSummary ? <p className="mt-4 text-sm text-text-secondary">{fileSummary}</p> : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {status === "idle" ? <span className="text-text-secondary">Ready to extract structured case facts.</span> : null}
          {status === "loading" ? (
            <span className="inline-flex items-center gap-2 text-text-primary">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent-gold" />
              Reading document...
            </span>
          ) : null}
          {status === "done" ? <span className="text-green-500">[Done] Fields auto-filled</span> : null}
        </div>
        <Button type="button" onClick={extract} disabled={!file || status === "loading"}>
          Extract from Document
        </Button>
      </div>

      {error ? <p className="text-sm text-state-error">{error}</p> : null}
    </div>
  );
}
