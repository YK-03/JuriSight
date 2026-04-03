"use client";

import { useLanguage } from "@/lib/language-context";
import { cn } from "../../lib/utils";;;

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-md border border-border bg-bg-card p-1">
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={cn(
          "rounded px-3 py-1 text-sm font-medium transition",
          language === "en" ? "bg-[#7C3AED] text-white" : "text-[#425466] hover:bg-bg-secondary",
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage("hi")}
        className={cn(
          "rounded px-3 py-1 text-sm font-medium transition",
          language === "hi" ? "bg-[#7C3AED] text-white" : "text-[#425466] hover:bg-bg-secondary",
        )}
      >
        {"\u0939\u093F\u0928\u094D\u0926\u0940"}
      </button>
    </div>
  );
}
