import { Card, CardContent } from "@/components/ui/card";

type LegalReasoningProps = {
  legalReasoning: string;
};

export function LegalReasoning({ legalReasoning }: LegalReasoningProps) {
  const paragraphs = legalReasoning
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Card className="rounded-2xl border border-border bg-bg-card shadow-panel">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-4">
          Legal Reasoning
        </h3>
      </div>
      <CardContent>
        <div>
          {paragraphs.map((paragraph, index) => (
            <p
              key={`${paragraph.slice(0, 24)}-${index}`}
              className="text-sm text-text-primary leading-relaxed mb-4 last:mb-0"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
