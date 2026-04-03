"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function BailApplicationGenerator({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const data = (await res.json()) as { draft: string };
      setDraft(data.draft);
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    const blob = new Blob([draft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bail-application-draft.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Draft downloaded");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" onClick={generate}>Generate Bail Application</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogTitle>Bail Application Draft</DialogTitle>
        <DialogDescription>{loading ? "Generating draft..." : "Review and export the generated bail application."}</DialogDescription>

        {loading ? (
          <div className="h-40 animate-pulse rounded-md border border-border bg-bg-secondary" />
        ) : (
          <pre className="max-h-[400px] overflow-y-auto rounded-lg border bg-[#F8F9FA] p-5 font-mono text-[13px] leading-6 text-[#2f2f2f] whitespace-pre-wrap">
            {draft || "No draft generated yet."}
          </pre>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(draft);
              toast.success("Draft copied to clipboard");
            }}
            disabled={!draft}
          >
            Copy to Clipboard
          </Button>
          <Button type="button" variant="outline" onClick={download} disabled={!draft}>Download as .txt</Button>
          <Button type="button" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
