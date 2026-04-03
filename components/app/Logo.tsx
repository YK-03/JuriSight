import Link from "next/link";
import type { Route } from "next";
import { cn } from "../../lib/utils";

export function Logo({
  href = "/",
  className,
  compact = false,
}: {
  href?: Route;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg-card transition-all duration-300 group-hover:border-accent-gold/70 group-hover:shadow-[0_0_0_1px_rgba(201,168,76,0.22)]">
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-5 w-5 text-accent-gold transition-transform duration-300 group-hover:scale-105"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 4v15" />
          <path d="M7.2 7.4h9.6" />
          <path d="M5.3 9.1l3.2 5.1H2.1l3.2-5.1z" />
          <path d="M18.7 9.1l3.2 5.1h-6.4l3.2-5.1z" />
          <path d="M8.3 19.2h7.4" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-[0.94rem] uppercase tracking-[0.22em] text-text-primary">JURISIGHT</span>
        {compact ? null : (
          <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-text-secondary">Legal Intelligence</span>
        )}
      </span>
    </Link>
  );
}
