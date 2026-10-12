"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  buildChatSessions,
  flattenChatSessions,
  CHAT_HISTORY_STORAGE_KEY,
  ChatMessage,
  parseStoredChatHistory,
} from "@/lib/chat-storage";
import { cn } from "@/lib/utils";

type ConversationItem = {
  id: string;
  sessionId: string;
  title: string;
  preview: string;
  source: "local" | "db";
  messages: ChatMessage[];
};

type MatterItem = {
  id: string;
  title: string;
  source: "local" | "db";
};

type DbSessionResponse = Array<{
  id: string;
  title: string;
  updatedAt: string;
  lastMessage: {
    id: string;
    role: string;
    content: string;
    createdAt: string;
  } | null;
}>;

type DbRecentCasesResponse = Array<{
  id: string;
  title: string;
}>;

type ChatWorkspaceSidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onSelectConversation: (messages: ChatMessage[], dbSessionId?: string | null) => void;
  activeDbSessionId: string | null;
  variant?: "panel" | "shell";
  collapsed?: boolean;
};

const CASE_HISTORY_STORAGE_KEY = "jurisight_case_history";

function truncate(value: string, maxLength = 64): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trim()}...`;
}

function loadLocalConversations(): ConversationItem[] {
  const grouped = buildChatSessions(parseStoredChatHistory(localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)));
  return grouped.map((session) => ({
    id: session.id,
    sessionId: session.id,
    title: session.title,
    preview: session.preview,
    source: "local",
    messages: session.messages,
  }));
}

function loadLocalMatters(): MatterItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CASE_HISTORY_STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is { id: string; caseTitle: string } => {
        return Boolean(item) && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" && typeof (item as { caseTitle?: unknown }).caseTitle === "string";
      })
      .slice(0, 8)
      .map((item) => ({ id: item.id, title: item.caseTitle, source: "local" as const }));
  } catch {
    return [];
  }
}

const itemFocusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary";

export function ChatWorkspaceSidebar({
  mobileOpen,
  onCloseMobile,
  onNewChat,
  onSelectConversation,
  activeDbSessionId,
  variant = "panel",
  collapsed = false,
}: ChatWorkspaceSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [matters, setMatters] = useState<MatterItem[]>([]);
  const [conversationsStatus, setConversationsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [casesStatus, setCasesStatus] = useState<"loading" | "ready" | "error">("loading");

  const loadHistory = useCallback(async () => {
    let conversationLoadedFromDb = false;
    let casesLoadedFromDb = false;

    setConversationsStatus((current) => (current === "ready" ? "ready" : "loading"));
    setCasesStatus((current) => (current === "ready" ? "ready" : "loading"));

    try {
      const sessionsResponse = await fetch("/api/chat/sessions?limit=30", { cache: "no-store" });
      if (sessionsResponse.ok) {
        const sessions: DbSessionResponse = await sessionsResponse.json();
        setConversations(
          sessions.map((session) => ({
            id: session.id,
            sessionId: session.id,
            title: session.title,
            preview: session.lastMessage?.content || "Continue this conversation.",
            source: "db" as const,
            messages: [],
          })),
        );
        conversationLoadedFromDb = true;
        setConversationsStatus("ready");
      }
    } catch {
      conversationLoadedFromDb = false;
    }

    if (!conversationLoadedFromDb) {
      try {
        setConversations(loadLocalConversations());
        setConversationsStatus("ready");
      } catch {
        setConversations([]);
        setConversationsStatus("error");
      }
    }

    try {
      const casesResponse = await fetch("/api/cases/recent", { cache: "no-store" });
      if (casesResponse.ok) {
        const recentCases: DbRecentCasesResponse = await casesResponse.json();
        setMatters(recentCases.map((item) => ({ id: item.id, title: item.title, source: "db" })));
        casesLoadedFromDb = true;
        setCasesStatus("ready");
      }
    } catch {
      casesLoadedFromDb = false;
    }

    if (!casesLoadedFromDb) {
      try {
        setMatters(loadLocalMatters());
        setCasesStatus("ready");
      } catch {
        setMatters([]);
        setCasesStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    window.addEventListener("jurisight_chats_updated", loadHistory);
    window.addEventListener("jurisight_cases_updated", loadHistory);
    return () => {
      window.removeEventListener("jurisight_chats_updated", loadHistory);
      window.removeEventListener("jurisight_cases_updated", loadHistory);
    };
  }, [loadHistory]);

  const handleDeleteConversation = async (sessionId: string, source: "local" | "db") => {
    if (source === "db") {
      setConversations((prev) => prev.filter((item) => item.sessionId !== sessionId));
      try {
        const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
        if (!res.ok) {
          window.dispatchEvent(new Event("jurisight_chats_updated"));
        }
      } catch {
        window.dispatchEvent(new Event("jurisight_chats_updated"));
      }
      return;
    }

    try {
      const remaining = buildChatSessions(
        parseStoredChatHistory(localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)),
      ).filter((session) => session.id !== sessionId);
      localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(flattenChatSessions(remaining)));
      window.dispatchEvent(new Event("jurisight_chats_updated"));
    } catch {
      // Keep the workspace usable if local history cannot be updated.
    }
  };

  const history = (
    <>
      <div className={cn("px-3 py-3", collapsed && "px-2")}>
        <Button
          type="button"
          variant="secondary"
          className={cn("w-full", collapsed ? "justify-center px-0" : "justify-start")}
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          aria-label="New chat"
          title="New chat"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          {collapsed ? null : <span>New chat</span>}
        </Button>
      </div>

      {collapsed ? null : (
        <div className="flex-1 overflow-y-auto px-2 pb-6">
          <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
            Recent chats
          </p>
          {conversationsStatus === "loading" ? (
            <p className="px-2 pb-4 text-xs leading-5 text-text-secondary">Loading conversations...</p>
          ) : conversationsStatus === "error" ? (
            <div className="px-2 pb-4">
              <p className="text-xs leading-5 text-text-secondary">Could not load conversations.</p>
              <Button type="button" variant="ghost" size="sm" className="mt-1 h-auto px-0" onClick={() => void loadHistory()}>
                Retry
              </Button>
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-2 pb-4 text-xs leading-5 text-text-secondary">No conversations yet.</p>
          ) : (
            <ul className="mb-6 space-y-0.5">
              {conversations.map((item) => {
                const isActive = item.source === "db" && item.sessionId === activeDbSessionId;
                return (
                  <li key={`${item.source}-${item.sessionId}`} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectConversation(item.messages, item.source === "db" ? item.sessionId : null);
                        onCloseMobile();
                      }}
                      title={item.title}
                      className={cn(
                        "min-w-0 flex-1 rounded-lg px-2 py-2 text-left transition",
                        itemFocusClass,
                        isActive ? "bg-bg-secondary text-text-primary" : "text-text-secondary hover:bg-bg-secondary/70 hover:text-text-primary",
                      )}
                    >
                      <span className="block truncate text-sm">{truncate(item.title)}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-text-secondary">{truncate(item.preview, 48)}</span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                      aria-label={`Delete ${item.title}`}
                      onClick={() => void handleDeleteConversation(item.sessionId, item.source)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                      </svg>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
            Recent cases
          </p>
          {casesStatus === "loading" ? (
            <p className="px-2 text-xs leading-5 text-text-secondary">Loading cases...</p>
          ) : casesStatus === "error" ? (
            <div className="px-2">
              <p className="text-xs leading-5 text-text-secondary">Could not load cases.</p>
              <Button type="button" variant="ghost" size="sm" className="mt-1 h-auto px-0" onClick={() => void loadHistory()}>
                Retry
              </Button>
            </div>
          ) : matters.length === 0 ? (
            <p className="px-2 text-xs leading-5 text-text-secondary">No saved cases yet. Use Analyze Case for structured intake.</p>
          ) : (
            <ul className="space-y-0.5">
              {matters.map((item) => {
                const isActive = pathname === `/dashboard/analysis/${item.id}`;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      title={item.title}
                      onClick={() => {
                        router.push(`/dashboard/analysis/${item.id}`);
                        onCloseMobile();
                      }}
                      className={cn(
                        "w-full truncate rounded-lg px-2 py-2 text-left text-sm transition",
                        itemFocusClass,
                        isActive ? "bg-bg-secondary text-text-primary" : "text-text-secondary hover:bg-bg-secondary/70 hover:text-text-primary",
                      )}
                    >
                      {item.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );

  if (variant === "shell") {
    return <div className="flex min-h-0 flex-1 flex-col">{history}</div>;
  }

  const asideClassName = `flex h-full w-[17.5rem] shrink-0 flex-col border-r border-border bg-bg-secondary/40 ${
    mobileOpen ? "fixed inset-y-0 left-0 z-50 md:static" : "hidden md:flex"
  }`;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          aria-label="Close sidebar"
          onClick={onCloseMobile}
        />
      ) : null}
      <aside className={asideClassName}>
        <div className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Workspace</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </Button>
        </div>
        {history}
      </aside>
    </>
  );
}
