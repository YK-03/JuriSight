"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  buildChatSessions,
  capChatHistory,
  CHAT_HISTORY_STORAGE_KEY,
  CHAT_SESSION_BREAK,
  ChatMessage,
  ChatSessionWithMessages,
  createChatMessage,
  flattenChatSessions,
  getLatestChatSession,
  parseStoredChatHistory,
} from "@/lib/chat-storage";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  sessionMessages?: ChatMessage[];
  dbSessionId?: string | null;
  caseId?: string | null;
}

const GREETING = "Hello, I'm your JuriSight legal awareness assistant. Ask about sections, procedures, definitions, or court process under Indian law.";

const POLICY_CONTEXT = `You are JuriSight's legal awareness assistant for Indian law.

You must only provide legal awareness content such as:
- definitions of offences and legal concepts
- relevant statutory sections
- procedural steps and court process
- short explanations of how a provision generally operates

You must refuse:
- case analysis
- outcome prediction
- legal advice
- drafting notices, complaints, petitions, affidavits, or other documents

If the user asks for any refused category, reply with exactly this sentence first:
"For full case analysis... use Analyze Case feature..."

Every answer must:
- stay under 200 words
- cite relevant sections such as IPC, BNS, CrPC, BNSS, or Evidence Act where applicable
- stay concise and neutral
- end with this disclaimer exactly:
"Disclaimer: This is legal information for awareness only, not legal advice. Please consult a licensed advocate for case-specific guidance."`;

function saveHistory(history: ChatMessage[]) {
  localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(capChatHistory(history)));
  window.dispatchEvent(new Event("jurisight_chats_updated"));
}

function readStoredChatHistory(): ChatMessage[] {
  try {
    return parseStoredChatHistory(localStorage.getItem(CHAT_HISTORY_STORAGE_KEY));
  } catch {
    return [];
  }
}

function resolveSessionId(messages: ChatMessage[]): string | null {
  if (messages.length === 0) {
    return null;
  }

  const sessions = buildChatSessions(readStoredChatHistory());

  return (
    sessions.find((session) => session.messages[0]?.id === messages[0]?.id)?.id ??
    createSessionFromMessages(messages, 0).id
  );
}

function replaceOrAppendSession(
  sessions: ChatSessionWithMessages[],
  activeSessionId: string | null,
  messages: ChatMessage[],
): ChatSessionWithMessages[] {
  if (!activeSessionId) {
    return [...sessions, createSessionFromMessages(messages, sessions.length)];
  }

  const sessionIndex = sessions.findIndex((session) => session.id === activeSessionId);
  if (sessionIndex === -1) {
    return [...sessions, createSessionFromMessages(messages, sessions.length)];
  }

  const nextSessions = [...sessions];
  nextSessions[sessionIndex] = createSessionFromMessages(messages, sessionIndex, activeSessionId);
  return nextSessions;
}

function createSessionFromMessages(
  messages: ChatMessage[],
  index: number,
  forcedId?: string,
): ChatSessionWithMessages {
  const sessions = buildChatSessions(messages);
  const fallbackSession =
    sessions[0] ??
    ({
      id: forcedId ?? `session-${Date.now()}-${index}`,
      title: "Untitled conversation",
      preview: "No messages yet",
      timestamp: Date.now(),
      messageCount: 0,
      messages: [],
    } satisfies ChatSessionWithMessages);

  if (forcedId) {
    return {
      ...fallbackSession,
      id: forcedId,
    };
  }

  return {
    ...fallbackSession,
    id: fallbackSession.id || `session-${Date.now()}-${index}`,
  };
}

function normalizeIncomingMessages(messages: ChatMessage[] | undefined): ChatMessage[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  return messages
    .map((message) => {
      const normalized = {
        ...message,
        content: message.content ?? "",
        timestamp:
          typeof message.timestamp === "number" && Number.isFinite(message.timestamp)
            ? message.timestamp
            : Date.now(),
      };

      return normalized;
    })
    .filter((message) => message.role === "user" || message.role === "model");
}

function formatApiMessages(messages: ChatMessage[]) {
  return [
    {
      role: "user" as const,
      parts: POLICY_CONTEXT,
      id: "jurisight-policy-context",
      timestamp: 1,
    },
    ...messages.map((message) => ({
      role: message.role,
      parts: message.content,
      id: message.id,
      timestamp: message.timestamp,
    })),
  ];
}

export function ChatPanel({
  isOpen,
  onClose,
  initialQuery,
  sessionMessages,
  dbSessionId: initialDbSessionId,
  caseId,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [dbSessionId, setDbSessionId] = useState<string | null>(initialDbSessionId ?? null);
  const autoSubmittedQueryRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const history = readStoredChatHistory();
    const latestSession = getLatestChatSession(history);

    if (latestSession) {
      setMessages(latestSession.messages);
      setActiveSessionId(latestSession.id);
      setDbSessionId(null);
      return;
    }

    setMessages([]);
    setActiveSessionId(null);
    setDbSessionId(null);
  }, []);

  useEffect(() => {
    const handleRestore = (event: Event) => {
      const customEvent = event as CustomEvent<{ messages?: ChatMessage[] }>;
      const restoredMessages = normalizeIncomingMessages(customEvent.detail?.messages);

      setMessages(restoredMessages);
      setActiveSessionId(resolveSessionId(restoredMessages));
      setDbSessionId(null);
    };

    window.addEventListener("open-chat", handleRestore);
    return () => window.removeEventListener("open-chat", handleRestore);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const restoredMessages = normalizeIncomingMessages(sessionMessages);
    if (restoredMessages.length === 0) {
      return;
    }

    setMessages(restoredMessages);
    setActiveSessionId(resolveSessionId(restoredMessages));
    setDbSessionId(initialDbSessionId ?? null);
  }, [initialDbSessionId, isOpen, sessionMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!isOpen || !initialQuery?.trim() || loading) {
      return;
    }

    const trimmedInitialQuery = initialQuery.trim();

    if (autoSubmittedQueryRef.current === trimmedInitialQuery) {
      return;
    }

    setMessages([]);
    setActiveSessionId(null);
    setDbSessionId(null);
    setInputValue("");
    autoSubmittedQueryRef.current = trimmedInitialQuery;
    const timer = window.setTimeout(() => {
      void handleSendMessage(trimmedInitialQuery, []);
    }, 100);

    return () => window.clearTimeout(timer);
  }, [initialQuery, isOpen, loading]);

  const handleNewChat = () => {
    const history = readStoredChatHistory();
    const nextHistory = capChatHistory([...history, createChatMessage("system", CHAT_SESSION_BREAK)]);

    saveHistory(nextHistory);
    setMessages([]);
    setInputValue("");
    setActiveSessionId(null);
    setDbSessionId(null);
    autoSubmittedQueryRef.current = null;
  };

  const handleSendMessage = async (text: string, baseMessages = messages) => {
    const trimmedText = text.trim();
    if (!trimmedText || loading) {
      return;
    }

    const userMessage = createChatMessage("user", trimmedText);
    const nextVisibleMessages = [...baseMessages, userMessage];

    setMessages(nextVisibleMessages);
    setInputValue("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: formatApiMessages(nextVisibleMessages),
          sessionId: dbSessionId,
          caseId,
        }),
      });
      const data = await response.json();

      if (!response.ok || typeof data.reply !== "string") {
        throw new Error(data.error || "Failed to fetch");
      }

      if (typeof data.sessionId === "string" && data.sessionId.trim()) {
        setDbSessionId(data.sessionId);
      }

      const assistantMessage = createChatMessage("model", data.reply);
      const finalMessages = [...nextVisibleMessages, assistantMessage];
      setMessages(finalMessages);

      const existingHistory = readStoredChatHistory();
      const existingSessions = buildChatSessions(existingHistory);
      const nextSessions = replaceOrAppendSession(existingSessions, activeSessionId, finalMessages);
      const flattenedHistory = flattenChatSessions(nextSessions);
      const savedSessions = buildChatSessions(flattenedHistory);
      const currentSession =
        savedSessions.find((session) => session.messages[0]?.id === finalMessages[0]?.id) ??
        savedSessions[savedSessions.length - 1] ??
        null;

      saveHistory(flattenedHistory);
      setActiveSessionId(currentSession?.id ?? null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to load a response right now.";

      setMessages((current) => [
        ...current,
        createChatMessage("model", `Something went wrong - ${errorMessage}`),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 100)}px`;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage(inputValue);
    }
  };

  return (
    <div
      className={`fixed right-0 top-0 z-50 flex h-screen w-[400px] max-w-full flex-col border-l border-zinc-200 bg-white transition-transform duration-300 dark:border-zinc-800 dark:bg-zinc-900 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Legal awareness assistant</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Definitions, sections, and procedure only
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded text-zinc-500 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">JuriSight</span>
          <button
            type="button"
            onClick={handleNewChat}
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 focus:outline-none dark:hover:text-zinc-300"
          >
            New Chat
          </button>
        </div>

        <div className="rounded-2xl border border-[#B8952A]/15 bg-[#B8952A]/8 px-3 py-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
          This assistant does not perform case analysis or legal advice. Use Analyze Case for matter-specific evaluation.
        </div>

        <div className="flex flex-col items-start">
          <div className="max-w-[92%] text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {GREETING}
          </div>
        </div>

        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div key={message.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
              {isUser ? (
                <div className="ml-auto max-w-[85%] rounded-2xl bg-amber-50 px-4 py-2 text-sm text-zinc-800 dark:bg-amber-950 dark:text-zinc-100">
                  {message.content}
                </div>
              ) : (
                <div
                  className={`max-w-[92%] text-sm leading-relaxed ${
                    message.content.startsWith("Something went wrong")
                      ? "text-red-500"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {message.content.split("\n").map((line, index) => (
                    <p key={`${message.id}-${index}`} className={index > 0 ? "mt-2" : ""}>
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {loading ? (
          <div className="flex items-start">
            <div className="text-lg tracking-widest text-zinc-400 animate-pulse">...</div>
          </div>
        ) : null}

        <div ref={bottomRef} className="shrink-0" />
      </div>

      <div className="relative shrink-0 border-t border-zinc-200 bg-white px-4 pb-4 pt-3 dark:border-zinc-800 dark:bg-zinc-900">
        <textarea
          value={inputValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="min-h-[44px] max-h-[100px] w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-3 pr-12 text-sm leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:disabled:bg-zinc-900"
          placeholder="Ask about sections, procedure, or legal definitions..."
          rows={1}
        />
        <button
          onClick={() => void handleSendMessage(inputValue)}
          disabled={!inputValue.trim() || loading}
          className="absolute bottom-[18px] right-6 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 transition-colors hover:bg-amber-600 focus:outline-none disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
