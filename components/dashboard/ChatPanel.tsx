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
  initialAttachedFile?: File | null;
  initialAttachedText?: string | null;
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
  initialAttachedFile,
  initialAttachedText,
  sessionMessages,
  dbSessionId: initialDbSessionId,
  caseId,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [dbSessionId, setDbSessionId] = useState<string | null>(initialDbSessionId ?? null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedText, setAttachedText] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<"idle" | "extracting" | "ready" | "error">("idle");
  const autoSubmittedQueryRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    autoSubmittedQueryRef.current = null;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setAttachedFile(null);
      setAttachedText(null);
      setFileStatus("error");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAttachedFile(null);
      setAttachedText(null);
      setFileStatus("error");
      return;
    }

    setAttachedFile(file);
    setAttachedText(null);
    setFileStatus("extracting");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract-document", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setFileStatus("error");
        return;
      }

      const extractedParts = [
        data.title && `Title: ${data.title}`,
        data.accusedName && `Accused: ${data.accusedName}`,
        data.firNumber && `FIR: ${data.firNumber}`,
        data.sections && `Sections: ${data.sections}`,
        data.allegations && `Allegations: ${data.allegations}`,
        data.policeStation && `Police Station: ${data.policeStation}`,
        data.district && `District: ${data.district}`,
        data.state && `State: ${data.state}`,
        data.arrestDate && `Arrest Date: ${data.arrestDate}`,
        data.custodyDuration && `Custody Duration: ${data.custodyDuration}`,
        data.previousConvictions != null && `Previous Convictions: ${data.previousConvictions ? "Yes" : "No"}`,
        data.notes && `Notes: ${data.notes}`,
      ].filter(Boolean).join("\n");

      setAttachedText(extractedParts || "Document processed but no content could be extracted.");
      setFileStatus("ready");
    } catch {
      setFileStatus("error");
    }
  };

  const clearAttachment = () => {
    setAttachedFile(null);
    setAttachedText(null);
    setFileStatus("idle");
  };

  const handleSendMessage = async (
    text: string, 
    baseMessages = messages, 
    overrideFile?: File | null, 
    overrideText?: string | null
  ) => {
    const trimmedText = text.trim();
    const currentFile = overrideFile !== undefined ? overrideFile : attachedFile;
    const currentText = overrideText !== undefined ? overrideText : attachedText;

    if ((!trimmedText && !currentText) || loading) {
      return;
    }

    const displayText = currentFile && currentText
      ? trimmedText
        ? `📄 ${currentFile.name}\n\n${trimmedText}`
        : `📄 ${currentFile.name}`
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
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to load a response right now.";

      setMessages((current) => [
        ...current,
        createChatMessage("model", `Error: ${errorMessage}`),
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
                    message.content.startsWith("Error:")
                      ? "text-red-500"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {message.content.split("\n").map((line, index) => (
                    <p key={`${message.id}-${index}`} className={index > 0 ? "mt-2" : ""}>
                      {line}
                    </p>
                  ))}
                  {message.content.startsWith("Error:") && (
                    <button
                      onClick={() => {
                        const userMsgs = messages.filter(m => m.role === "user");
                        const lastUserMsg = userMsgs[userMsgs.length - 1];
                        if (lastUserMsg) {
                          setMessages(messages.slice(0, -1));
                          void handleSendMessage(lastUserMsg.content, messages.slice(0, -2));
                        }
                      }}
                      className="mt-2 text-xs font-semibold text-red-600 underline underline-offset-4 hover:text-red-700"
                    >
                      Retry sending
                    </button>
                  )}
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

      <div className="shrink-0 border-t border-zinc-200 bg-white px-4 pb-4 pt-3 dark:border-zinc-800 dark:bg-zinc-900">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {attachedFile && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-500">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="flex-1 truncate text-xs text-zinc-600 dark:text-zinc-300">{attachedFile.name}</span>
            {fileStatus === "extracting" && (
              <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-[2px] border-zinc-300 border-t-amber-500" />
            )}
            {fileStatus === "ready" && (
              <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Ready</span>
            )}
            {fileStatus === "error" && (
              <span className="text-[10px] font-medium text-red-500">Failed</span>
            )}
            <button
              type="button"
              onClick={clearAttachment}
              className="shrink-0 rounded p-0.5 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || fileStatus === "extracting"}
            className="absolute bottom-[10px] left-3 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <textarea
            value={inputValue}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="min-h-[44px] max-h-[100px] w-full resize-none rounded-xl border border-zinc-200 bg-white py-3 pl-12 pr-12 text-sm leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:disabled:bg-zinc-900"
            placeholder="Describe a case, ask a legal question, or upload a document..."
            rows={1}
          />
          <button
            onClick={() => void handleSendMessage(inputValue)}
            disabled={(!inputValue.trim() && fileStatus !== "ready") || loading || fileStatus === "extracting"}
            className="absolute bottom-[10px] right-3 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 transition-colors hover:bg-amber-600 focus:outline-none disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
