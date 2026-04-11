"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { HeroInput } from "@/components/dashboard/HeroInput";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentCases } from "@/components/dashboard/Recent Cases/RecentCases";
import { ChatPanel } from "@/components/dashboard/ChatPanel";
import { ChatMessage } from "@/lib/chat-storage";

export default function DashboardPage() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const handleHeroSubmit = (query: string) => {
    setInitialQuery(query);
    setChatHistory([]);
    setIsChatOpen(true);
  };

  const handleOpenWithHistory = (messages: ChatMessage[]) => {
    setChatHistory(messages);
    setInitialQuery("");
    setIsChatOpen(true);
  };

  return (
    <DashboardShell>
      <DashboardHeader />
      <main className="flex-1 flex flex-col items-center w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-24 space-y-12 pb-24">
        <HeroInput onSubmit={handleHeroSubmit} />
        <QuickActions />
        <RecentCases onOpenWithHistory={handleOpenWithHistory} />
      </main>
      
      <ChatPanel 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        initialQuery={initialQuery}
        sessionMessages={chatHistory}
      />
    </DashboardShell>
  );
}
