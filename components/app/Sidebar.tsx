"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ComponentType } from "react";
import { usePathname } from "next/navigation";
import { Eye, FolderKanban, LayoutDashboard, Scale, Shield } from "lucide-react";
import { cn } from "../../lib/utils";;;
import { useLanguage } from "@/lib/language-context";

type Item = { href: Route; key: "dashboard" | "cases" | "quickCheck" | "newCase" | "authorities" | "seeHowItWorks"; icon: ComponentType<{ className?: string }> };

const items: Item[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/cases", key: "cases", icon: FolderKanban },
  { href: "/quick-check", key: "quickCheck", icon: Scale },
  { href: "/cases/new", key: "newCase", icon: Scale },
  { href: "/authorities", key: "authorities", icon: Shield },
  { href: "/demo", key: "seeHowItWorks", icon: Eye },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-bg-secondary p-4 lg:block">
      <div className="mb-6 px-2 font-mono text-xs uppercase tracking-[0.22em] text-text-secondary">Navigator</div>
      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition",
                active
                  ? "border-accent-gold/60 bg-accent-gold/10 text-accent-gold"
                  : "border-transparent text-text-secondary hover:border-border hover:text-text-primary",
              )}
            >
              <Icon className="h-4 w-4" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
