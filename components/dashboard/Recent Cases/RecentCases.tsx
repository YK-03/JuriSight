"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CaseItem } from "./CaseItem";
import {
  buildChatSessions,
  flattenChatSessions,
  CHAT_HISTORY_STORAGE_KEY,
  ChatMessage,
  parseStoredChatHistory,
} from "@/lib/chat-storage";

type CaseHistoryEntry = {
  id: string;
  caseTitle: string;
  summary: string;
  createdAt: string;
  status: string;
  source: "local" | "db";
  riskScore?: number | null;
  verdict?: string | null;
};

type ConversationItem = {
  id: string;
  sessionId: string;
  content: string;
  preview: string;
  timestamp: number;
  messages: ChatMessage[];
  source: "local" | "db";
};

type DbSessionResponse = Array<{
  id: string;
  title: string;
  updatedAt: string;
  caseId: string | null;
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
  createdAt: string;
  status: string;
  analysis: {
    riskScore: number;
    eligibilityStatus: string;
    recommendation: string;
    verdict?: string | null;
  } | null;
}>;

interface RecentCasesProps {
  onOpenWithHistory: (messages: ChatMessage[], dbSessionId?: string | null) => void;
}

const CASE_HISTORY_STORAGE_KEY = "jurisight_case_history";
const MAX_ITEMS = 5;

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatCaseDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(parsed);
}

function truncatePreview(value: string, maxLength = 80): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trim()}...`;
}

function parseStoredCaseHistory(raw: string | null): CaseHistoryEntry[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Omit<CaseHistoryEntry, "source"> => {
        if (!item || typeof item !== "object") {
          return false;
        }

        const record = item as Partial<CaseHistoryEntry>;
        return (
          typeof record.id === "string" &&
          typeof record.caseTitle === "string" &&
          typeof record.summary === "string" &&
          typeof record.createdAt === "string" &&
          typeof record.status === "string"
        );
      })
      .slice(0, MAX_ITEMS)
      .map((item) => ({
        ...item,
        source: "local" as const,
      }));
  } catch {
    return [];
  }
}

function loadLocalConversationItems() {
  const chatHistory = parseStoredChatHistory(localStorage.getItem(CHAT_HISTORY_STORAGE_KEY));
  const groupedSessions = buildChatSessions(chatHistory);

  return groupedSessions
    .flatMap((session) =>
      session.messages
        .filter((message) => message.role === "user")
        .map((message) => ({
          id: message.id,
          sessionId: session.id,
          content: message.content,
          preview: "Open this conversation in the legal awareness chat.",
          timestamp: message.timestamp,
          messages: session.messages,
          source: "local" as const,
        })),
    )
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_ITEMS);
}

function mapDbSessionToConversationItems(sessions: DbSessionResponse): ConversationItem[] {
  return sessions.map((session) => {
    const lastMessageTimestamp = session.lastMessage
      ? new Date(session.lastMessage.createdAt).getTime()
      : new Date(session.updatedAt).getTime();

    const messages: ChatMessage[] = session.lastMessage
      ? [
          {
            id: session.lastMessage.id,
            role: session.lastMessage.role === "assistant" ? "model" : "user",
            content: session.lastMessage.content,
            timestamp: lastMessageTimestamp,
          },
        ]
      : [];

    return {
      id: session.lastMessage?.id ?? session.id,
      sessionId: session.id,
      content: session.title,
      preview: session.lastMessage?.content || "Continue this saved conversation.",
      timestamp: lastMessageTimestamp,
      messages,
      source: "db",
    };
  });
}

function getRiskLabel(score: number): string {
  if (score >= 70) return "High Risk";
  if (score >= 40) return "Moderate Risk";
  return "Low Risk";
}

function mapVerdictToLabel(eligibility: string): string {
  switch (eligibility) {
    case "LIKELY_ELIGIBLE": return "FAVORABLE";
    case "LIKELY_INELIGIBLE": return "UNFAVORABLE";
    case "BORDERLINE": return "MIXED";
    default: return eligibility;
  }
}

function mapDbCasesToCaseItems(cases: DbRecentCasesResponse): CaseHistoryEntry[] {
  return cases.map((item) => ({
    id: item.id,
    caseTitle: item.title,
    summary: item.analysis?.recommendation || "Analysis saved and ready for review.",
    createdAt: item.createdAt,
    status: item.analysis
      ? mapVerdictToLabel(item.analysis.eligibilityStatus)
      : item.status,
    source: "db",
    riskScore: item.analysis?.riskScore ?? null,
    verdict: item.analysis?.eligibilityStatus ?? null,
  }));
}

export function RecentCases({ onOpenWithHistory }: RecentCasesProps) {
  const router = useRouter();
  const [conversationItems, setConversationItems] = useState<ConversationItem[]>([]);
  const [caseItems, setCaseItems] = useState<CaseHistoryEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCaseClick = useCallback((caseId: string) => {
    router.push(`/dashboard/analysis/${caseId}`);
  }, [router]);

  const handleShareCase = useCallback((caseId: string, title?: string) => {
    const url = `${window.location.origin}/share/${caseId}`;

    if (typeof navigator.share === "function") {
      navigator.share({
        title: title || "JuriSight Case Analysis",
        text: `Check out this legal case analysis on JuriSight`,
        url,
      }).catch(() => {
        // User cancelled or share failed — fall back to clipboard
        navigator.clipboard.writeText(url).then(() => {
          setCopiedId(caseId);
          setTimeout(() => setCopiedId(null), 2000);
        });
      });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedId(caseId);
        setTimeout(() => setCopiedId(null), 2000);
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      let conversationLoadedFromDb = false;
      let casesLoadedFromDb = false;

      try {
        const sessionsResponse = await fetch("/api/chat/sessions", { cache: "no-store" });
        if (sessionsResponse.ok) {
          const sessions: DbSessionResponse = await sessionsResponse.json();
          if (!cancelled) {
            setConversationItems(mapDbSessionToConversationItems(sessions));
          }
          conversationLoadedFromDb = true;
        }
      } catch {
        conversationLoadedFromDb = false;
      }

      if (!conversationLoadedFromDb && !cancelled) {
        try {
          setConversationItems(loadLocalConversationItems());
        } catch {
          setConversationItems([]);
        }
      }

      try {
        const casesResponse = await fetch("/api/cases/recent", { cache: "no-store" });
        if (casesResponse.ok) {
          const recentCases: DbRecentCasesResponse = await casesResponse.json();
          if (!cancelled) {
            setCaseItems(mapDbCasesToCaseItems(recentCases));
          }
          casesLoadedFromDb = true;
        }
      } catch {
        casesLoadedFromDb = false;
      }

      if (!casesLoadedFromDb && !cancelled) {
        try {
          const storedCases = parseStoredCaseHistory(localStorage.getItem(CASE_HISTORY_STORAGE_KEY));
          setCaseItems(storedCases.slice(0, MAX_ITEMS));
        } catch {
          setCaseItems([]);
        }
      }
    };

    void loadHistory();
    window.addEventListener("jurisight_chats_updated", loadHistory);
    window.addEventListener("jurisight_cases_updated", loadHistory);

    return () => {
      cancelled = true;
      window.removeEventListener("jurisight_chats_updated", loadHistory);
      window.removeEventListener("jurisight_cases_updated", loadHistory);
    };
  }, []);

  const handleDeleteConversation = useCallback(async (sessionId: string, source: "local" | "db") => {
    if (source === "db") {
      setConversationItems((prev) => prev.filter((c) => c.sessionId !== sessionId));
      try {
        const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
        if (!res.ok) {
          window.dispatchEvent(new Event("jurisight_chats_updated"));
        }
      } catch {
        window.dispatchEvent(new Event("jurisight_chats_updated"));
      }
    } else {
      try {
        const chatHistory = parseStoredChatHistory(localStorage.getItem(CHAT_HISTORY_STORAGE_KEY));
        const remainingSessions = buildChatSessions(chatHistory).filter((session) => session.id !== sessionId);
        localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(flattenChatSessions(remainingSessions)));
        window.dispatchEvent(new Event("jurisight_chats_updated"));
      } catch {
        // Ignore localStorage failures to keep the dashboard usable.
      }
    }
  }, []);

  const handleDeleteCase = useCallback(async (caseId: string, source: "local" | "db") => {
    if (source === "db") {
      // Optimistically remove from UI
      setCaseItems((prev) => prev.filter((c) => c.id !== caseId));
      try {
        const res = await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
        if (!res.ok) {
          // Re-fetch to restore if delete failed
          window.dispatchEvent(new Event("jurisight_cases_updated"));
        }
      } catch {
        window.dispatchEvent(new Event("jurisight_cases_updated"));
      }
    } else {
      try {
        const storedCases = parseStoredCaseHistory(localStorage.getItem(CASE_HISTORY_STORAGE_KEY));
        localStorage.setItem(
          CASE_HISTORY_STORAGE_KEY,
          JSON.stringify(storedCases.filter((item) => item.id !== caseId)),
        );
        window.dispatchEvent(new Event("jurisight_cases_updated"));
      } catch {
        // Ignore localStorage failures to keep the dashboard usable.
      }
    }
  }, []);

  return (
    <div className="w-full flex flex-col gap-5">
      <div className="w-full flex flex-col gap-5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold text-text-secondary tracking-wider uppercase">Recent Conversations</h2>
        </div>
        <div className="flex flex-col rounded-2xl border border-border/40 bg-bg-card/20 overflow-hidden shadow-panel">
          {conversationItems.length > 0 ? (
            conversationItems.map((item, index) => (
              <CaseItem
                key={item.id}
                title={truncatePreview(item.content)}
                preview={truncatePreview(item.preview)}
                date={formatTimestamp(item.timestamp)}
                isLast={index === conversationItems.length - 1}
                onClick={() => onOpenWithHistory(item.messages, item.source === "db" ? item.sessionId : null)}
                onDelete={() => handleDeleteConversation(item.sessionId, item.source)}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/50 bg-bg-secondary/40 text-text-secondary">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-text-primary">No conversations yet</p>
              <p className="max-w-sm text-sm text-text-secondary">
                Start a legal awareness chat to see your recent conversations here.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="w-full flex flex-col gap-5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold text-text-secondary tracking-wider uppercase">Recent Cases</h2>
        </div>
        <div className="flex flex-col rounded-2xl border border-border/40 bg-bg-card/20 overflow-hidden shadow-panel">
          {caseItems.length > 0 ? (
            caseItems.map((item, index) => (
              <CaseItem
                key={item.id}
                title={item.caseTitle}
                preview={truncatePreview(item.summary)}
                date={formatCaseDate(item.createdAt)}
                isLast={index === caseItems.length - 1}
                onClick={() => handleCaseClick(item.id)}
                onDelete={() => handleDeleteCase(item.id, item.source)}
                onShare={() => handleShareCase(item.id, item.caseTitle)}
                riskBadge={
                  item.riskScore != null
                    ? `${item.riskScore} • ${getRiskLabel(item.riskScore)}`
                    : null
                }
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/50 bg-bg-secondary/40 text-text-secondary">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                  <path d="M14 3v5h5" />
                  <path d="M9 13h6" />
                  <path d="M9 17h4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-text-primary">No cases yet. Use Analyze Case to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
