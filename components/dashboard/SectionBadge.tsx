"use client";

import { Badge } from "@/components/ui/badge";

export function SectionBadge({ section }: { section: string }) {
  return (
    <Badge
      variant="outline"
      className="rounded-full border-neutral-200/10 bg-bg-secondary/45 px-3 py-1 text-[11px] tracking-[0.16em] text-text-secondary"
    >
      {section}
    </Badge>
  );
}
