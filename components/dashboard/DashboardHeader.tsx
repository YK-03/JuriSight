"use client";

import type { Ref } from "react";
import { UserButton } from "@clerk/nextjs";
import { Logo } from "../app/Logo";
import { ThemeToggle } from "../app/ThemeToggle";
import { Button } from "@/components/ui/button";

export function DashboardHeader({
  menuButtonId,
  menuButtonRef,
  mobileNavOpen,
  onOpenMobileNav,
}: {
  menuButtonId?: string;
  menuButtonRef?: Ref<HTMLButtonElement>;
  mobileNavOpen?: boolean;
  onOpenMobileNav?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 w-full shrink-0 bg-bg-primary/80 backdrop-blur-md border-b border-border/40">
      <div className="flex h-16 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {onOpenMobileNav ? (
            <Button
              id={menuButtonId}
              ref={menuButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 md:hidden"
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              aria-controls="dashboard-sidebar"
              onClick={onOpenMobileNav}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </Button>
          ) : null}
          <Logo compact href="/dashboard" />
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/45 bg-bg-card p-0.5 shadow-panel transition-all duration-200 hover:border-accent">
            <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
          </div>
        </div>
      </div>
    </header>
  );
}
