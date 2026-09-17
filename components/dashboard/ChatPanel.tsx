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
import { extractDocumentFromPdf } from "@/lib/extract-document-client";
import { Button } from "@/components/ui/button";
import { ChatWorkspaceSidebar } from "@/components/dashboard/ChatWorkspaceSidebar";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  initialAttachedFile?: File | null;
  initialAttachedText?: string | null;
  sessionMessages?: ChatMessage[];
  dbSessionId?: string | null;
  caseId?: string | null;
}

const GREETING = "Tell me what you are working on. Attach a document if it helps, then ask a follow-up whenever you need it.";

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
  return messages.map((message) => ({
    role: message.role,
    parts: message.content,
    id: message.id,
    timestamp: message.timestamp,
  }));
}

function mapSessionPayload(value: unknown): ChatMessage[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as { messages?: unknown };
  if (!Array.isArray(record.messages)) {
    return [];
  }

  return record.messages.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const message = item as { id?: unknown; role?: unknown; content?: unknown; timestamp?: unknown };
    const role = message.role === "model" || message.role === "user" ? message.role : null;
    if (!role || typeof message.content !== "string") {
      return [];
    }
    return [
      {
        id: typeof message.id === "string" ? message.id : `${Date.now()}`,
        role,
        content: message.content,
        timestamp: typeof message.timestamp === "number" ? message.timestamp : Date.now(),
      } satisfies ChatMessage,
    ];
  });
}

export function ChatPanel({
  isOpen,
  onClose,
  initialQuery,
  initialAttachedFile,
  initialAttachedText,
  sessionMessages,
  dbSessionId: initialDbSessionId,
  caseId,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [dbSessionId, setDbSessionId] = useState<string | null>(initialDbSessionId ?? null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedText, setAttachedText] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<"idle" | "extracting" | "ready" | "error">("idle");
  const [fileError, setFileError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const autoSubmittedQueryRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

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

    const trimmedInitialQuery = initialQuery?.trim() || "";
    if (trimmedInitialQuery || initialAttachedText) {
      return;
    }

    if (initialDbSessionId) {
      void (async () => {
        try {
          const res = await fetch(`/api/chat/sessions/${initialDbSessionId}`, { cache: "no-store" });
          if (res.ok) {
            const payload: unknown = await res.json();
            const loaded = mapSessionPayload(payload);
            if (loaded.length > 0) {
              setMessages(loaded);
              setActiveSessionId(initialDbSessionId);
              setDbSessionId(initialDbSessionId);
              return;
            }
          }
        } catch {
          // Fall back to whatever messages were passed from the dashboard.
        }

        const restoredMessages = normalizeIncomingMessages(sessionMessages);
        setMessages(restoredMessages);
        setActiveSessionId(resolveSessionId(restoredMessages));
        setDbSessionId(initialDbSessionId);
      })();
      return;
    }

    const restoredMessages = normalizeIncomingMessages(sessionMessages);
    if (restoredMessages.length === 0) {
      return;
    }

    setMessages(restoredMessages);
    setActiveSessionId(resolveSessionId(restoredMessages));
    setDbSessionId(null);
  }, [initialAttachedText, initialDbSessionId, initialQuery, isOpen, sessionMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const trimmedInitialQuery = initialQuery?.trim() || "";

    if (!isOpen || (!trimmedInitialQuery && !initialAttachedText) || loading) {
      return;
    }

    const submissionKey = `${trimmedInitialQuery}|${initialAttachedFile?.name || ""}|${initialAttachedFile?.size || ""}`;

    if (autoSubmittedQueryRef.current === submissionKey) {
      return;
    }

    setMessages([]);
    setActiveSessionId(null);
    setDbSessionId(null);
    setInputValue("");
    setSendError(null);
    autoSubmittedQueryRef.current = submissionKey;
    const timer = window.setTimeout(() => {
      void handleSendMessage(trimmedInitialQuery, [], initialAttachedFile, initialAttachedText);
    }, 100);

    return () => window.clearTimeout(timer);
  }, [initialQuery, isOpen, loading, initialAttachedFile, initialAttachedText]);

  const handleNewChat = () => {
    const history = readStoredChatHistory();
    const nextHistory = capChatHistory([...history, createChatMessage("system", CHAT_SESSION_BREAK)]);

    saveHistory(nextHistory);
    setMessages([]);
    setInputValue("");
    setActiveSessionId(null);
    setDbSessionId(null);
    setSendError(null);
    autoSubmittedQueryRef.current = null;
    composerRef.current?.focus();
  };

  const handleSelectConversation = async (incoming: ChatMessage[], nextDbSessionId?: string | null) => {
    setSendError(null);
    autoSubmittedQueryRef.current = null;

    if (nextDbSessionId) {
      try {
        const res = await fetch(`/api/chat/sessions/${nextDbSessionId}`, { cache: "no-store" });
        if (res.ok) {
          const payload: unknown = await res.json();
          const loaded = mapSessionPayload(payload);
          if (loaded.length > 0) {
            setMessages(loaded);
            setActiveSessionId(nextDbSessionId);
            setDbSessionId(nextDbSessionId);
            return;
          }
        }
      } catch {
        // Use the supplied messages if the session cannot be loaded.
      }
    }

    const restored = normalizeIncomingMessages(incoming);
    setMessages(restored);
    setActiveSessionId(resolveSessionId(restored));
    setDbSessionId(nextDbSessionId ?? null);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (!file) {
      return;
    }

    setAttachedFile(file);
    setAttachedText(null);
    setFileError(null);
    setFileStatus("extracting");

    const result = await extractDocumentFromPdf(file);
    if (result.ok === false) {
      setFileStatus("error");
      setFileError(result.error);
      return;
    }

    setAttachedText(result.text);
    setFileStatus("ready");
  };

  const clearAttachment = () => {
    setAttachedFile(null);
    setAttachedText(null);
    setFileStatus("idle");
    setFileError(null);
  };

  const handleSendMessage = async (
    text: string,
    baseMessages = messages,
    overrideFile?: File | null,
    overrideText?: string | null,
  ) => {
    const trimmedText = text.trim();
    const currentFile = overrideFile !== undefined ? overrideFile : attachedFile;
    const currentText = overrideText !== undefined ? overrideText : attachedText;

    if ((!trimmedText && !currentText) || loading) {
      return;
    }

    const displayText =
      currentFile && currentText
        ? trimmedText
          ? `${currentFile.name}\n\n${trimmedText}`
          : currentFile.name
        : trimmedText;

    const contextText = currentText
      ? trimmedText
        ? `[Uploaded Document: ${currentFile?.name ?? "document.pdf"}]\n${currentText}\n\nUser question: ${trimmedText}`
        : `[Uploaded Document: ${currentFile?.name ?? "document.pdf"}]\n${currentText}\n\nPlease analyze this document and provide key legal observations.`
      : trimmedText;

    const userMessage = createChatMessage("user", displayText);
    const contextMessage = { ...userMessage, content: contextText };
    const nextVisibleMessages = [...baseMessages, userMessage];
    const nextContextMessages = [...baseMessages, contextMessage];

    setMessages(nextVisibleMessages);
    setInputValue("");
    setSendError(null);
    clearAttachment();
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: formatApiMessages(nextContextMessages),
          sessionId: dbSessionId,
          caseId,
        }),
      });
      const data = await response.json();

      if (!response.ok || data.success === false || typeof data.reply !== "string") {
        throw new Error("send-failed");
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
    } catch {
      setSendError("Something went wrong while sending your message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage(inputValue);
    }
  };

  return (
    <div
      className={`fixed inset-0 top-16 z-40 flex bg-bg-primary ${isOpen ? "" : "hidden"}`}
      aria-hidden={!isOpen}
    >
      <ChatWorkspaceSidebar
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectConversation={(incoming, nextDbId) => {
          void handleSelectConversation(incoming, nextDbId);
        }}
        activeDbSessionId={dbSessionId}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-3 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open conversations"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </Button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-medium text-text-primary">Conversation</h2>
              <p className="truncate text-xs text-text-secondary">Ask a question, add a document, then continue.</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            Back to desk
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-8">
          <div className="mx-auto w-full max-w-3xl">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-border bg-bg-card px-5 py-6 shadow-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Jurisight</p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-text-primary">{GREETING}</p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-5">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div key={message.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                    <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-text-secondary">
                      {isUser ? "You" : "Jurisight"}
                    </p>
                    {isUser ? (
                      <div className="max-w-[min(85%,36rem)] whitespace-pre-wrap rounded-xl border border-border bg-bg-card px-4 py-3 text-sm leading-6 text-text-primary">
                        {message.content}
                      </div>
                    ) : (
                      <div className="w-full max-w-[42rem] border-l-[3px] border-accent pl-4 text-[0.95rem] leading-7 text-text-primary">
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
                <p className="text-sm text-text-secondary">Reviewing your question...</p>
              ) : null}

              {sendError ? (
                <div className="rounded-xl border border-state-error/25 bg-state-error/10 px-4 py-3 text-sm text-state-error">
                  <p>{sendError}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-auto px-0 text-state-error"
                    onClick={() => {
                      const lastUserIndex = [...messages]
                        .map((message, index) => ({ message, index }))
                        .reverse()
                        .find((entry) => entry.message.role === "user")?.index;
                      if (lastUserIndex == null) {
                        return;
                      }
                      void handleSendMessage(messages[lastUserIndex].content, messages.slice(0, lastUserIndex));
                    }}
                  >
                    Retry sending
                  </Button>
                </div>
              ) : null}

              <div ref={bottomRef} className="shrink-0" />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border/40 bg-bg-primary px-3 py-3 sm:px-8 sm:pb-5">
          <div className="mx-auto w-full max-w-3xl">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            {attachedFile && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-bg-card px-3 py-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-accent">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="flex-1 truncate text-xs text-text-secondary">{attachedFile.name}</span>
                {fileStatus === "extracting" && (
                  <span className="text-[11px] text-text-secondary">Your document is being processed...</span>
                )}
                {fileStatus === "ready" && (
                  <span className="text-[10px] font-medium text-state-success">Attached</span>
                )}
                {fileStatus === "error" && (
                  <span className="text-[10px] font-medium text-state-error">Not attached</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearAttachment}
                  className="h-6 w-6 p-1 text-text-secondary hover:text-text-primary"
                  aria-label="Remove attachment"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </Button>
              </div>
            )}

            {fileError ? <p className="mb-2 text-sm text-state-error">{fileError}</p> : null}

            <div className="flex items-end gap-1 rounded-xl border border-border bg-bg-card px-1 py-1 shadow-panel focus-within:border-accent/50 focus-within:ring-4 focus-within:ring-accent/10">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || fileStatus === "extracting"}
                className="mb-1 ml-1 h-9 w-9 shrink-0 text-text-secondary hover:text-text-primary"
                aria-label="Attach PDF"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </Button>
              <textarea
                ref={composerRef}
                value={inputValue}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="min-h-[56px] max-h-[160px] flex-1 resize-none bg-transparent py-3 px-2 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-secondary dark:disabled:bg-transparent"
                placeholder="Ask Jurisight..."
                rows={1}
              />
              <Button
                variant="primary"
                size="icon"
                onClick={() => void handleSendMessage(inputValue)}
                disabled={(!inputValue.trim() && fileStatus !== "ready") || loading || fileStatus === "extracting"}
                className="mb-1 mr-1 h-9 w-9 shrink-0"
                aria-label="Send"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
