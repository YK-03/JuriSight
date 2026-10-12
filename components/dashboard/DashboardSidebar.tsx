"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatWorkspaceSidebar } from "@/components/dashboard/ChatWorkspaceSidebar";
import { useChatWorkspace } from "@/components/dashboard/chat-workspace-context";

type DashboardSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
};

const NAV_ITEMS: Array<{
  href: Route;
  label: string;
  match: (pathname: string) => boolean;
  icon: ReactNode;
}> = [
  {
    href: "/dashboard",
    label: "Home",
    match: (pathname) => pathname === "/dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6 10v9h12v-9" />
      </svg>
    ),
  },
  {
    href: "/dashboard/analyze",
    label: "Analyze Case",
    match: (pathname) =>
      pathname === "/dashboard/analyze" || pathname.startsWith("/dashboard/analysis"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 3v18" />
        <path d="M5 7h14" />
        <path d="M7 7c0 3-2 5-2 5s-2-2-2-5" />
        <path d="M21 7c0 3-2 5-2 5s-2-2-2-5" />
        <path d="M8 19h8" />
      </svg>
    ),
  },
  {
    href: "/dashboard/bail-strategy",
    label: "Bail Eligibility",
    match: (pathname) => pathname.startsWith("/dashboard/bail-strategy"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M9 3h6" />
        <path d="M10 6h4" />
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
];

function focusRingClassName() {
  return "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary";
}

export function DashboardSidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { requestNewChat, requestCloseChat, requestOpenConversation, activeDbSessionId } = useChatWorkspace();
  const desktopCollapsed = collapsed && !mobileOpen;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          aria-label="Close menu"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        id="dashboard-sidebar"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label="Dashboard navigation"
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-border bg-bg-secondary/40",
          desktopCollapsed ? "md:w-[4.5rem]" : "md:w-[17.5rem]",
          "fixed inset-y-0 left-0 z-50 w-[17.5rem] md:static md:z-auto",
          mobileOpen ? "flex" : "hidden md:flex",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center border-b border-border/40 px-3 py-3",
            desktopCollapsed ? "justify-center" : "justify-between gap-2",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden h-9 w-9 md:inline-flex"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
          >
            {collapsed ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 6h16" />
                <path d="M4 12h10" />
                <path d="M4 18h16" />
                <path d="m14 9 3 3-3 3" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 6h16" />
                <path d="M4 12h10" />
                <path d="M4 18h16" />
                <path d="m17 9-3 3 3 3" />
              </svg>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </Button>
        </div>

        <nav aria-label="Dashboard" className="px-2 py-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.match(pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    title={item.label}
                    onClick={() => {
                      if (item.href === "/dashboard") {
                        requestCloseChat();
                      }
                      onCloseMobile();
                    }}
                    className={cn(
                      "flex items-center rounded-lg px-2 py-2 text-sm transition",
                      desktopCollapsed ? "justify-center" : "gap-3",
                      focusRingClassName(),
                      isActive
                        ? "bg-bg-secondary text-text-primary"
                        : "text-text-secondary hover:bg-bg-secondary/70 hover:text-text-primary",
                    )}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {desktopCollapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <ChatWorkspaceSidebar
          variant="shell"
          collapsed={desktopCollapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={onCloseMobile}
          onNewChat={requestNewChat}
          onSelectConversation={requestOpenConversation}
          activeDbSessionId={activeDbSessionId}
        />
      </aside>
    </>
  );
}
