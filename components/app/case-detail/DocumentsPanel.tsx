"use client";

import type { Document as PrismaDocument } from "@prisma/client";
import { PDFUploader } from "../../../components/app/PDFUploader";

export function DocumentsPanel({
  caseId,
  documents,
}: {
  caseId: string;
  documents: PrismaDocument[];
}) {
  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel">
        <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
          Upload Document
        </h3>
        <PDFUploader caseId={caseId} />
      </div>

      {/* Document list */}
      <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel">
        <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
          Uploaded Documents
          {documents.length > 0 && (
            <span className="ml-2 rounded-full bg-accent-gold/15 px-1.5 py-0.5 font-mono text-[10px] text-accent-gold">
              {documents.length}
            </span>
          )}
        </h3>

        {documents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-bg-primary/50 p-8 text-center">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mx-auto text-text-secondary/40"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <p className="mt-3 text-sm font-medium text-text-secondary">
              No documents uploaded
            </p>
            <p className="mt-1 text-xs text-text-secondary/60">
              Upload a PDF to include case documents in the analysis.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="group flex items-center justify-between rounded-lg border border-border bg-bg-primary/50 px-4 py-3 transition-all hover:border-accent-gold/30 hover:bg-bg-primary"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-state-error/10">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-state-error"
                    >
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {doc.filename}
                    </p>
                    <p className="font-mono text-[10px] text-text-secondary">
                      {new Date(doc.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* File icon indicator */}
                <span className="font-mono text-[10px] uppercase tracking-wide text-text-secondary/60">
                  PDF
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
