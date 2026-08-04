"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");

    const shouldDark = saved ? saved === "dark" : false;

    document.documentElement.classList.toggle("dark", shouldDark);
    setIsDark(shouldDark);
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "h-10 w-[4.5rem] rounded-full border border-black/[0.08] bg-white/80 p-1 shadow-[0_4px_14px_rgba(17,24,39,0.08)]",
          "dark:border-white/[0.1] dark:bg-[#13161b]/80",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const next = !isDark;
        setIsDark(next);
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("theme", next ? "dark" : "light");
      }}
      className={cn(
        "group relative inline-flex h-10 w-[4.5rem] items-center rounded-full border p-1",
        "border-black/[0.08] bg-white/80 shadow-[0_4px_14px_rgba(17,24,39,0.08)] backdrop-blur-sm",
        "transition-all duration-300 hover:-translate-y-px hover:border-accent-gold/60 hover:shadow-[0_7px_20px_rgba(17,24,39,0.12)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50 focus-visible:ring-offset-2",
        "dark:border-white/[0.1] dark:bg-[#13161b]/80 dark:shadow-[0_5px_18px_rgba(0,0,0,0.28)] dark:hover:border-accent-gold/70 dark:hover:shadow-[0_8px_22px_rgba(0,0,0,0.4)]",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute h-8 w-8 rounded-full bg-accent-gold shadow-[0_2px_8px_rgba(200,166,74,0.35)]",
          "transition-transform duration-300 ease-out",
          isDark ? "translate-x-8" : "translate-x-0",
        )}
      />
      <Sun
        aria-hidden="true"
        className={cn(
          "z-10 ml-2 h-4 w-4 transition-colors duration-300",
          isDark ? "text-text-secondary/60" : "text-white",
        )}
      />
      <Moon
        aria-hidden="true"
        className={cn(
          "z-10 ml-4 h-4 w-4 transition-colors duration-300",
          isDark ? "text-white" : "text-text-secondary/60",
        )}
      />
    </button>
  );
}
