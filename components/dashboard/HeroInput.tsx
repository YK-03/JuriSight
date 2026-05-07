"use client";

import React, { useState, useRef, KeyboardEvent } from "react";

interface HeroInputProps {
  onSubmit?: (query: string, attachedFile?: File | null, attachedText?: string | null) => void;
}

export function HeroInput({ onSubmit }: HeroInputProps = {}) {
  const [description, setDescription] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedText, setAttachedText] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<"idle" | "extracting" | "ready" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setAttachedFile(null);
      setAttachedText(null);
      setFileStatus("error");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAttachedFile(null);
      setAttachedText(null);
      setFileStatus("error");
      return;
    }

    setAttachedFile(file);
    setAttachedText(null);
    setFileStatus("extracting");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract-document", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setFileStatus("error");
        return;
      }

      const extractedParts = [
        data.title && `Title: ${data.title}`,
        data.accusedName && `Accused: ${data.accusedName}`,
        data.firNumber && `FIR: ${data.firNumber}`,
        data.sections && `Sections: ${data.sections}`,
        data.allegations && `Allegations: ${data.allegations}`,
        data.policeStation && `Police Station: ${data.policeStation}`,
        data.district && `District: ${data.district}`,
        data.state && `State: ${data.state}`,
        data.arrestDate && `Arrest Date: ${data.arrestDate}`,
        data.custodyDuration && `Custody Duration: ${data.custodyDuration}`,
        data.previousConvictions != null && `Previous Convictions: ${data.previousConvictions ? "Yes" : "No"}`,
        data.notes && `Notes: ${data.notes}`,
      ].filter(Boolean).join("\n");

      setAttachedText(extractedParts || "Document processed but no content could be extracted.");
      setFileStatus("ready");
    } catch {
      setFileStatus("error");
    }
  };

  const clearAttachment = () => {
    setAttachedFile(null);
    setAttachedText(null);
    setFileStatus("idle");
  };

  const submitAnalysis = async () => {
    const trimmedDescription = description.trim();
    if (!trimmedDescription && !attachedText) {
      return;
    }

    onSubmit?.(trimmedDescription, attachedFile, attachedText);
    setDescription("");
    clearAttachment();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submitAnalysis();
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="relative flex flex-col bg-bg-card border border-border/60 hover:border-[#B8952A]/40 shadow-panel rounded-2xl p-2 transition-all duration-300 focus-within:border-[#B8952A]/60 focus-within:ring-4 focus-within:ring-[#B8952A]/10">
        {attachedFile && (
          <div className="mx-2 mt-1 mb-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-500">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="flex-1 truncate text-xs text-zinc-600 dark:text-zinc-300">{attachedFile.name}</span>
            {fileStatus === "extracting" && (
              <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-[2px] border-zinc-300 border-t-amber-500" />
            )}
            {fileStatus === "ready" && (
              <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Ready</span>
            )}
            {fileStatus === "error" && (
              <span className="text-[10px] font-medium text-red-500">Failed</span>
            )}
            <button
              type="button"
              onClick={clearAttachment}
              className="shrink-0 rounded p-0.5 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        )}
        
        <div className="flex items-end">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="application/pdf"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={fileStatus === "extracting"}
            className="p-3 text-text-secondary hover:text-[#B8952A] transition-colors rounded-xl hover:bg-[#B8952A]/10 focus:outline-none focus:ring-2 focus:ring-[#B8952A]/20 disabled:opacity-40"
            title="Upload document"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <textarea
            ref={textareaRef}
            value={description}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[60px] max-h-[200px] bg-transparent resize-none outline-none text-text-primary placeholder:text-text-secondary px-3 py-4 text-base leading-relaxed font-sans"
            placeholder="Describe a case, ask a legal question, or upload a document..."
            rows={1}
          />
          <button
            onClick={submitAnalysis}
            disabled={(!description.trim() && fileStatus !== "ready") || fileStatus === "extracting"}
            className="p-3 bg-[#B8952A] text-white hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 transition-all duration-300 rounded-xl shadow-sm ml-2 mb-1 focus:outline-none focus:ring-2 focus:ring-[#B8952A]/40 flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      <p className="text-[13px] text-text-secondary text-center px-4 font-mono tracking-[0.02em] uppercase">
        JuriSight uses advanced AI. <span className="text-[#B8952A]/80">Verify critical legal information.</span>
      </p>
    </div>
  );
}
