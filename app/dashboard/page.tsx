"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { HeroInput } from "@/components/dashboard/HeroInput";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentCases } from "@/components/dashboard/Recent Cases/RecentCases";
import { ChatPanel } from "@/components/dashboard/ChatPanel";
import { ChatMessage } from "@/lib/chat-storage";

export default function DashboardPage() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState("");
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [initialExtractedText, setInitialExtractedText] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [selectedDbSessionId, setSelectedDbSessionId] = useState<string | null>(null);

  const handleHeroSubmit = (query: string, attachedFile?: File | null, attachedText?: string | null) => {
    setInitialQuery(query);
    setInitialFile(attachedFile ?? null);
    setInitialExtractedText(attachedText ?? null);
    setChatHistory([]);
    setSelectedDbSessionId(null);
    setIsChatOpen(true);
  };

  const handleOpenWithHistory = (messages: ChatMessage[], dbSessionId?: string | null) => {
    setChatHistory(messages);
    setSelectedDbSessionId(dbSessionId ?? null);
    setInitialQuery("");
    setInitialFile(null);
    setInitialExtractedText(null);
    setIsChatOpen(true);
  };

  return (
    <DashboardShell>
      <main className="flex-1 flex flex-col items-center w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-24 space-y-10 pb-24">
        <div className="w-full space-y-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            What&apos;s on your desk?
          </h1>
          <p className="mx-auto max-w-xl text-sm leading-6 text-text-secondary sm:text-base">
            Tell Jurisight what you&apos;re working on, ask a legal question, or add a document.
          </p>
        </div>
        <HeroInput onSubmit={handleHeroSubmit} />
        <QuickActions />
        <RecentCases onOpenWithHistory={handleOpenWithHistory} />
      </main>

      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        initialQuery={initialQuery}
        initialAttachedFile={initialFile}
        initialAttachedText={initialExtractedText}
        sessionMessages={chatHistory}
        dbSessionId={selectedDbSessionId}
      />
    </DashboardShell>
  );
}
