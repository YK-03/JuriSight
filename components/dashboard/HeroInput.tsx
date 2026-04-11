"use client";

import React, { useState, useRef, KeyboardEvent } from "react";

interface HeroInputProps {
  onSubmit?: (query: string) => void;
}

export function HeroInput({ onSubmit }: HeroInputProps = {}) {
  const [description, setDescription] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const submitAnalysis = async () => {
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      return;
    }

    onSubmit?.(trimmedDescription);
    setDescription("");
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
      <div className="relative flex items-end bg-bg-card border border-border/60 hover:border-[#B8952A]/40 shadow-panel rounded-2xl p-2 transition-all duration-300 focus-within:border-[#B8952A]/60 focus-within:ring-4 focus-within:ring-[#B8952A]/10">
        <label
          className="p-3 text-text-secondary hover:text-[#B8952A] transition-colors rounded-xl hover:bg-[#B8952A]/10 focus:outline-none focus:ring-2 focus:ring-[#B8952A]/20 cursor-pointer"
          title="Upload document"
        >
          <input
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            disabled={false}
          />
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
        </label>
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
          disabled={!description.trim()}
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
      <p className="text-[13px] text-text-secondary text-center px-4 font-mono tracking-[0.02em] uppercase">
        JuriSight uses advanced AI. <span className="text-[#B8952A]/80">Verify critical legal information.</span>
      </p>
    </div>
  );
}
    
