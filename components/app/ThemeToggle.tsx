"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "h-10 w-[4.5rem] rounded-full border border-border bg-bg-card/80 p-1 shadow-panel",
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
        "group relative inline-flex h-10 w-[4.5rem] items-center rounded-full border border-border bg-bg-card/80 p-1 shadow-panel backdrop-blur-sm",
        "transition-all duration-300 hover:-translate-y-px hover:border-accent/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute h-8 w-8 rounded-full bg-text-primary",
          "transition-transform duration-300 ease-out",
          isDark ? "translate-x-8" : "translate-x-0",
        )}
      />
      <Sun
        aria-hidden="true"
        className={cn(
          "z-10 ml-2 h-4 w-4 transition-colors duration-300",
          isDark ? "text-text-secondary" : "text-bg-card",
        )}
      />
      <Moon
        aria-hidden="true"
        className={cn(
          "z-10 ml-4 h-4 w-4 transition-colors duration-300",
          isDark ? "text-bg-primary" : "text-text-secondary",
        )}
      />
    </button>
  );
}
