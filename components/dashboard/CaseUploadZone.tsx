"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const STORAGE_KEY = "jurisight:new-case-upload";

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function CaseUploadZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const acceptFile = (nextFile: File | null) => {
    setError(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (nextFile.type !== "application/pdf") {
      setError("PDF files only.");
      setFile(null);
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      setError("File must be 10MB or smaller.");
      setFile(null);
      return;
    }

    setFile(nextFile);
  };

  const goToNewCase = async () => {
    setError(null);

    if (!file) {
      sessionStorage.removeItem(STORAGE_KEY);
      router.push("/cases/new");
      return;
    }

    try {
      setIsSaving(true);
      const dataUrl = await readFileAsDataUrl(file);
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl,
        }),
      );
      router.push("/cases/new");
    } catch {
      setError("Could not prepare the file for the new case form.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
          isDragging
            ? "border-accent-gold bg-accent-gold/5"
            : "border-border bg-bg-secondary/45"
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full text-center outline-none"
        >
          <p className="text-lg font-medium text-text-primary">
            Drop a case document here - FIR, charge sheet, or remand order
          </p>
          <p className="mt-2 text-sm text-text-secondary">PDF only · max 10MB</p>
        </button>
        {file ? (
          <div className="mt-5 text-sm text-text-primary">
            <span>{file.name}</span>
            <span className="mx-2 text-text-secondary">·</span>
            <span>{formatFileSize(file.size)}</span>
            <button
              type="button"
              onClick={() => acceptFile(null)}
              className="ml-4 text-text-secondary underline underline-offset-4 hover:text-text-primary"
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="button" onClick={goToNewCase} disabled={isSaving}>
          {isSaving ? "Preparing file..." : "Create New Case \u2192"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/quick-check")}>
          Quick Eligibility Check
        </Button>
      </div>

      {error ? <p className="text-sm text-state-error">{error}</p> : null}
    </div>
  );
}
