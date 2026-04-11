"use client";

import { useEffect, useState } from "react";
import { CaseItem } from "./CaseItem";
import {
  buildChatSessions,
  flattenChatSessions,
  CHAT_HISTORY_STORAGE_KEY,
  ChatMessage,
  parseStoredChatHistory,
} from "@/lib/chat-storage";

type CaseHistoryStatus = "Intake" | "Analyzing" | "Action needed" | "In progress" | "Educated";

type CaseHistoryEntry = {
  id: string;
  caseTitle: string;
  summary: string;
  createdAt: string;
  status: CaseHistoryStatus;
};

interface RecentCasesProps {
  onOpenWithHistory: (messages: ChatMessage[]) => void;
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
      .filter((item): item is CaseHistoryEntry => {
        if (!item || typeof item !== "object") {
          return false;
        }

        const record = item as Partial<CaseHistoryEntry>;
        return (
          typeof record.id === "string" &&
          typeof record.caseTitle === "string" &&
          typeof record.summary === "string" &&
          typeof record.createdAt === "string" &&
          (record.status === "Intake" ||
            record.status === "Analyzing" ||
            record.status === "Action needed" ||
            record.status === "In progress" ||
            record.status === "Educated")
        );
      })
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function RecentCases({ onOpenWithHistory }: RecentCasesProps) {
  const [conversationItems, setConversationItems] = useState<
    Array<{
      id: string;
      sessionId: string;
      content: string;
      timestamp: number;
      messages: ChatMessage[];
    }>
  >([]);
  const [caseItems, setCaseItems] = useState<CaseHistoryEntry[]>([]);

  useEffect(() => {
    const loadHistory = () => {
      try {
        const chatHistory = parseStoredChatHistory(localStorage.getItem(CHAT_HISTORY_STORAGE_KEY));
        const groupedSessions = buildChatSessions(chatHistory);
        const recentUserMessages = groupedSessions
          .flatMap((session) =>
            session.messages
              .filter((message) => message.role === "user")
              .map((message) => ({
                id: message.id,
                sessionId: session.id,
                content: message.content,
                timestamp: message.timestamp,
                messages: session.messages,
              })),
          )
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, MAX_ITEMS);

        setConversationItems(recentUserMessages);
      } catch {
        setConversationItems([]);
      }

      try {
        const storedCases = parseStoredCaseHistory(localStorage.getItem(CASE_HISTORY_STORAGE_KEY));
        setCaseItems(storedCases.slice(0, MAX_ITEMS));
      } catch {
        setCaseItems([]);
      }
    };

    loadHistory();
    window.addEventListener("jurisight_chats_updated", loadHistory);
    window.addEventListener("jurisight_cases_updated", loadHistory);

    return () => {
      window.removeEventListener("jurisight_chats_updated", loadHistory);
      window.removeEventListener("jurisight_cases_updated", loadHistory);
    };
  }, []);

  const handleDeleteConversation = (sessionId: string) => {
    try {
      const chatHistory = parseStoredChatHistory(localStorage.getItem(CHAT_HISTORY_STORAGE_KEY));
      const remainingSessions = buildChatSessions(chatHistory).filter((session) => session.id !== sessionId);
      localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(flattenChatSessions(remainingSessions)));
      window.dispatchEvent(new Event("jurisight_chats_updated"));
    } catch {
      // Ignore localStorage failures to keep the dashboard usable.
    }
  };

  const handleDeleteCase = (caseId: string) => {
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
  };

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
                preview="Open this conversation in the legal awareness chat."
                status="Saved"
                date={formatTimestamp(item.timestamp)}
                isLast={index === conversationItems.length - 1}
                onClick={() => onOpenWithHistory(item.messages)}
                onDelete={() => handleDeleteConversation(item.sessionId)}
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
                status={item.status}
                date={formatCaseDate(item.createdAt)}
                isLast={index === caseItems.length - 1}
                onDelete={() => handleDeleteCase(item.id)}
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
