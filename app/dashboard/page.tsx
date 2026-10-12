"use client";

import { useEffect, useRef, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { HeroInput, type HeroInputHandle } from "@/components/dashboard/HeroInput";
import { ChatPanel } from "@/components/dashboard/ChatPanel";
import { useChatWorkspace } from "@/components/dashboard/chat-workspace-context";

const SAMPLE_PROMPTS = [
  "What is the difference between regular bail and anticipatory bail?",
  "How can I evaluate whether a judgment is relevant to a legal issue?",
  "Help me understand a legal provision in plain language.",
  "What should I look for when reviewing an uploaded legal document?",
] as const;

export default function DashboardPage() {
  const { chatOpenRequested, chatCloseRequested } = useChatWorkspace();
  const [isChatOpen, setIsChatOpen] = useState(chatOpenRequested > 0);
  const [draftQuery, setDraftQuery] = useState("");
  const [initialQuery, setInitialQuery] = useState("");
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [initialExtractedText, setInitialExtractedText] = useState<string | null>(null);
  const heroInputRef = useRef<HeroInputHandle>(null);

  useEffect(() => {
    if (chatOpenRequested > 0) {
      setIsChatOpen(true);
    }
  }, [chatOpenRequested]);

  useEffect(() => {
    if (chatCloseRequested > 0) {
      setIsChatOpen(false);
    }
  }, [chatCloseRequested]);

  const handleHeroSubmit = (query: string, attachedFile?: File | null, attachedText?: string | null) => {
    setDraftQuery("");
    setInitialQuery(query);
    setInitialFile(attachedFile ?? null);
    setInitialExtractedText(attachedText ?? null);
    setIsChatOpen(true);
  };

  return (
    <DashboardShell className={isChatOpen ? "h-full min-h-0 overflow-hidden" : undefined}>
      <main
        className={`mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14 lg:px-8 ${isChatOpen ? "hidden" : ""}`}
        aria-hidden={isChatOpen}
      >
        <div className="w-full max-w-3xl space-y-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            What&apos;s on your desk?
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
            Ask a legal question, describe a matter, or add a document for context.
          </p>
        </div>

        <div className="mt-10 grid w-full items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
          <section aria-labelledby="ask-jurisight-heading" className="min-w-0">
            <h2 id="ask-jurisight-heading" className="sr-only">Ask JuriSight</h2>
            <HeroInput
              ref={heroInputRef}
              value={draftQuery}
              onValueChange={setDraftQuery}
              onSubmit={handleHeroSubmit}
            />
          </section>

          <aside className="rounded-xl border border-border bg-bg-card p-4 shadow-panel sm:p-5" aria-labelledby="sample-prompts-heading">
            <div className="mb-3">
              <h2 id="sample-prompts-heading" className="text-sm font-semibold text-text-primary">Try these questions</h2>
              <p className="mt-1 text-xs leading-5 text-text-secondary">Choose a starting point, then edit it before sending.</p>
            </div>
            <div className="grid gap-2">
              {SAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="rounded-lg border border-border/70 bg-bg-secondary/45 px-3 py-2.5 text-left text-sm leading-5 text-text-primary transition hover:border-accent/50 hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
                  onClick={() => {
                    setDraftQuery(prompt);
                    heroInputRef.current?.focusInput();
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </aside>
        </div>
      </main>

      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        initialQuery={initialQuery}
        initialAttachedFile={initialFile}
        initialAttachedText={initialExtractedText}
      />
    </DashboardShell>
  );
}
