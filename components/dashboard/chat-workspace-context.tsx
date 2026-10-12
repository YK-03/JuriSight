"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ChatMessage } from "@/lib/chat-storage";

type ChatController = {
  newChat: () => void;
  selectConversation: (messages: ChatMessage[], dbSessionId?: string | null) => void;
};

type PendingChatAction =
  | { type: "new" }
  | { type: "open"; messages: ChatMessage[]; dbSessionId: string | null };

type ChatWorkspaceContextValue = {
  activeDbSessionId: string | null;
  chatOpenRequested: number;
  chatCloseRequested: number;
  requestNewChat: () => void;
  requestCloseChat: () => void;
  requestOpenConversation: (messages: ChatMessage[], dbSessionId?: string | null) => void;
  registerController: (controller: ChatController | null) => void;
  setActiveDbSessionId: (id: string | null) => void;
  peekPendingChatAction: () => PendingChatAction | null;
};

const ChatWorkspaceContext = createContext<ChatWorkspaceContextValue | null>(null);

function applyPendingAction(controller: ChatController, pending: PendingChatAction) {
  if (pending.type === "new") {
    controller.newChat();
    return;
  }

  controller.selectConversation(pending.messages, pending.dbSessionId);
}

export function ChatWorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const controllerRef = useRef<ChatController | null>(null);
  const pendingRef = useRef<PendingChatAction | null>(null);
  const [activeDbSessionId, setActiveDbSessionId] = useState<string | null>(null);
  const [chatOpenRequested, setChatOpenRequested] = useState(0);
  const [chatCloseRequested, setChatCloseRequested] = useState(0);

  const goHomeIfNeeded = useCallback(() => {
    if (pathname !== "/dashboard") {
      router.push("/dashboard");
    }
  }, [pathname, router]);

  const requestCloseChat = useCallback(() => {
    pendingRef.current = null;
    setChatCloseRequested((count) => count + 1);
  }, []);

  const requestNewChat = useCallback(() => {
    pendingRef.current = { type: "new" };
    setChatOpenRequested((count) => count + 1);

    if (controllerRef.current) {
      applyPendingAction(controllerRef.current, pendingRef.current);
      pendingRef.current = null;
    }

    goHomeIfNeeded();
  }, [goHomeIfNeeded]);

  const requestOpenConversation = useCallback(
    (messages: ChatMessage[], dbSessionId?: string | null) => {
      pendingRef.current = {
        type: "open",
        messages,
        dbSessionId: dbSessionId ?? null,
      };
      setChatOpenRequested((count) => count + 1);

      if (controllerRef.current) {
        applyPendingAction(controllerRef.current, pendingRef.current);
        pendingRef.current = null;
      }

      goHomeIfNeeded();
    },
    [goHomeIfNeeded],
  );

  const peekPendingChatAction = useCallback(() => pendingRef.current, []);

  const registerController = useCallback((controller: ChatController | null) => {
    controllerRef.current = controller;
    if (!controller || !pendingRef.current) {
      return;
    }

    const pending = pendingRef.current;
    pendingRef.current = null;
    applyPendingAction(controller, pending);
  }, []);

  const value = useMemo(
    () => ({
      activeDbSessionId,
      chatOpenRequested,
      chatCloseRequested,
      requestNewChat,
      requestCloseChat,
      requestOpenConversation,
      registerController,
      setActiveDbSessionId,
      peekPendingChatAction,
    }),
    [
      activeDbSessionId,
      chatCloseRequested,
      chatOpenRequested,
      peekPendingChatAction,
      registerController,
      requestCloseChat,
      requestNewChat,
      requestOpenConversation,
    ],
  );

  return <ChatWorkspaceContext.Provider value={value}>{children}</ChatWorkspaceContext.Provider>;
}

export function useChatWorkspace() {
  const context = useContext(ChatWorkspaceContext);
  if (!context) {
    throw new Error("useChatWorkspace must be used within ChatWorkspaceProvider");
  }
  return context;
}
