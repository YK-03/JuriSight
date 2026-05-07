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
    return <button className={cn("h-9 w-9 rounded-md border border-border bg-bg-card", className)} aria-label="Toggle theme" />;
  }

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => {
        const next = !isDark;
        setIsDark(next);
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("theme", next ? "dark" : "light");
      }}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg-card text-text-secondary transition-all duration-300 hover:border-border-hover hover:text-text-primary",
        className,
      )}
    >
      <Sun
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "rotate-90 scale-0 opacity-0",
        )}
      />

      <Moon
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          isDark
            ? "-rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100",
        )}
      />
    </button>
  );
}
