"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { ChatWorkspaceProvider } from "@/components/dashboard/chat-workspace-context";

const SIDEBAR_COLLAPSED_KEY = "jurisight_sidebar_collapsed";

export function DashboardAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const menuButtonId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      setCollapsed(false);
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previouslyFocused = document.activeElement;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      } else {
        menuButtonRef.current?.focus();
      }
    };
  }, [mobileOpen]);

  const handleToggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Keep the in-memory sidebar state if persistence is unavailable.
      }
      return next;
    });
  };

  return (
    <ChatWorkspaceProvider>
      <div className="flex h-dvh overflow-hidden bg-bg-primary text-text-primary selection:bg-accent/20">
        <a
          href="#dashboard-main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-bg-card focus:px-3 focus:py-2 focus:text-sm focus:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          Skip to main content
        </a>

        <DashboardSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggleCollapsed={handleToggleCollapsed}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader
            menuButtonId={menuButtonId}
            menuButtonRef={menuButtonRef}
            mobileNavOpen={mobileOpen}
            onOpenMobileNav={() => setMobileOpen(true)}
          />
          <div
            id="dashboard-main-content"
            className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto"
          >
            {children}
          </div>
        </div>
      </div>
    </ChatWorkspaceProvider>
  );
}
