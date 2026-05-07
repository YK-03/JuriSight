export type ChatRole = "user" | "model" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
};

export type ChatSession = {
  id: string;
  title: string;
  preview: string;
  timestamp: number;
  messageCount: number;
};

export type ChatSessionWithMessages = ChatSession & {
  messages: ChatMessage[];
};

export const CHAT_HISTORY_STORAGE_KEY = "jurisight_chat_history";
export const CHAT_SESSION_BREAK = "**SESSION_BREAK**";
const SESSION_GAP_MS = 30 * 60 * 1000;

export function createChatMessage(role: ChatRole, content: string, timestamp = Date.now()): ChatMessage {
  return {
    id: `${timestamp}-${Math.random().toString(36).slice(2, 10)}`,
    role,
    content,
    timestamp,
  };
}

export function normalizeChatMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as {
    id?: unknown;
    role?: unknown;
    content?: unknown;
    parts?: unknown;
    timestamp?: unknown;
  };

  const role =
    record.role === "user" || record.role === "model" || record.role === "system"
      ? record.role
      : null;
  const rawContent =
    typeof record.content === "string"
      ? record.content
      : typeof record.parts === "string"
        ? record.parts
        : null;

  if (!role || rawContent === null) {
    return null;
  }

  const timestamp =
    typeof record.timestamp === "number" && Number.isFinite(record.timestamp)
      ? record.timestamp
      : Date.now();

  return {
    id: typeof record.id === "string" ? record.id : `${timestamp}-${Math.random().toString(36).slice(2, 10)}`,
    role,
    content: rawContent,
    timestamp,
  };
}

export function parseStoredChatHistory(raw: string | null): ChatMessage[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeChatMessage)
      .filter((message): message is ChatMessage => Boolean(message))
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}

export function capChatHistory(messages: ChatMessage[], maxMessages = 200): ChatMessage[] {
  if (messages.length <= maxMessages) {
    return messages;
  }

  return messages.slice(messages.length - maxMessages);
}

export function isSessionBreakMessage(message: ChatMessage): boolean {
  return message.role === "system" && message.content === CHAT_SESSION_BREAK;
}

function buildSessionTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content.trim() || "";
  
  if (firstUserMessage.startsWith("📄")) {
    const lines = firstUserMessage.split("\n");
    const fileNameLine = lines[0].replace("📄", "").trim();
    const userQueryLine = lines.find(l => l.trim() && !l.startsWith("📄") && !l.startsWith("["));
    
    if (userQueryLine) {
      return `Document: ${fileNameLine} (${userQueryLine.slice(0, 20)}...)`;
    }
    return `Document: ${fileNameLine}`;
  }

  const source = firstUserMessage || messages[0]?.content.trim() || "Untitled conversation";
  return source.length > 50 ? `${source.slice(0, 50).trim()}...` : source;
}

function buildSessionPreview(messages: ChatMessage[]): string {
  const lastVisibleMessage = [...messages]
    .reverse()
    .find((message) => message.role === "model" || message.role === "user");

  const source = lastVisibleMessage?.content.trim() || "No messages yet";
  return source.length > 72 ? `${source.slice(0, 72).trim()}...` : source;
}

export function buildChatSessions(messages: ChatMessage[]): ChatSessionWithMessages[] {
  const sessions: ChatSessionWithMessages[] = [];
  let current: ChatMessage[] = [];
  let previousVisibleTimestamp: number | null = null;

  const pushCurrentSession = () => {
    if (current.length === 0) {
      return;
    }

    const visibleMessages = current.filter((message) => !isSessionBreakMessage(message));
    if (visibleMessages.length === 0) {
      current = [];
      return;
    }

    const timestamp = visibleMessages[visibleMessages.length - 1].timestamp;
    const idBase = visibleMessages[0].timestamp;

    sessions.push({
      id: `session-${idBase}-${sessions.length}`,
      title: buildSessionTitle(visibleMessages),
      preview: buildSessionPreview(visibleMessages),
      timestamp,
      messageCount: visibleMessages.length,
      messages: visibleMessages,
    });

    current = [];
  };

  for (const message of messages) {
    if (isSessionBreakMessage(message)) {
      pushCurrentSession();
      previousVisibleTimestamp = null;
      continue;
    }

    if (
      previousVisibleTimestamp !== null &&
      message.timestamp - previousVisibleTimestamp > SESSION_GAP_MS
    ) {
      pushCurrentSession();
    }

    current.push(message);
    previousVisibleTimestamp = message.timestamp;
  }

  pushCurrentSession();

  return sessions;
}

export function flattenChatSessions(sessions: ChatSessionWithMessages[]): ChatMessage[] {
  const flattened: ChatMessage[] = [];

  sessions.forEach((session, index) => {
    if (index > 0) {
      const previousTimestamp =
        flattened.length > 0 ? flattened[flattened.length - 1].timestamp + 1 : Date.now();
      flattened.push(createChatMessage("system", CHAT_SESSION_BREAK, previousTimestamp));
    }

    flattened.push(...session.messages);
  });

  return capChatHistory(flattened);
}

export function getLatestChatSession(messages: ChatMessage[]): ChatSessionWithMessages | null {
  const sessions = buildChatSessions(messages);
  return sessions.length > 0 ? sessions[sessions.length - 1] : null;
}
