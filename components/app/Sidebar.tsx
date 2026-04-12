"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ComponentType } from "react";
import { usePathname } from "next/navigation";
import { Eye, FolderKanban, LayoutDashboard, Scale, Shield } from "lucide-react";
import { cn } from "../../lib/utils";
import { useLanguage } from "@/lib/language-context";
import { useState, useEffect } from "react";

type Item = { href: Route; key: "dashboard" | "cases" | "newCase" | "authorities" | "seeHowItWorks"; icon: ComponentType<{ className?: string }> };

const items: Item[] = [
  { href: "/dashboard" as Route, key: "dashboard", icon: LayoutDashboard },
  { href: "/cases" as Route, key: "cases", icon: FolderKanban },
  { href: "/cases/new" as Route, key: "newCase", icon: Scale },
  { href: "/authorities" as Route, key: "authorities", icon: Shield },
  { href: "/guest" as Route, key: "seeHowItWorks", icon: Eye },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const [chatHistory, setChatHistory] = useState<any[]>([]);

  useEffect(() => {
    const loadChats = () => {
      try {
        const stored = localStorage.getItem("jurisight_conversations");
        if (stored) setChatHistory(JSON.parse(stored));
      } catch (e) {}
    };
    
    loadChats();
    window.addEventListener("jurisight_chats_updated", loadChats);
    return () => window.removeEventListener("jurisight_chats_updated", loadChats);
  }, []);

  const restoreChat = (chat: any) => {
    window.dispatchEvent(new CustomEvent("open-chat", { detail: chat }));
  };

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

      {chatHistory.length > 0 && (
        <div className="mt-10">
          <div className="mb-4 px-2 font-mono text-xs uppercase tracking-[0.22em] text-text-secondary">
            Recent Chats
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {chatHistory.map((chat, idx) => (
              <button
                key={idx}
                onClick={() => restoreChat(chat)}
                className="flex w-full flex-col items-start gap-1 rounded-md border border-transparent px-3 py-2 text-left text-sm text-text-secondary transition hover:border-border hover:bg-bg-primary hover:text-text-primary"
              >
                <span className="block w-full truncate font-medium text-text-primary">
                  {chat.title}
                </span>
                <span className="block w-full truncate text-[11px] opacity-80">
                  {chat.preview}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
