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
    <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold tracking-widest text-gray-400 dark:text-gray-500 uppercase mb-4">
          Legal Reasoning
        </h3>
      </div>
      <CardContent>
        <div>
          {paragraphs.map((paragraph, index) => (
            <p
              key={`${paragraph.slice(0, 24)}-${index}`}
              className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4 last:mb-0"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
