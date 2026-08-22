import { Card, CardContent } from "@/components/ui/card";

type Section = {
  code: string;
  title: string;
  relevance: string;
};

type ApplicableSectionsProps = {
  sections: Section[];
};

export function ApplicableSections({ sections }: ApplicableSectionsProps) {
  return (
    <Card className="rounded-2xl border border-border bg-bg-card shadow-panel">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-4">
          Applicable Sections
        </h3>
      </div>
      <CardContent>
        <ul>
          {sections.map((sec, i) => (
            <li
              key={i}
              className="flex items-start gap-3 pb-3 mb-3 border-b border-border/40 last:border-0 last:pb-0 last:mb-0"
            >
              <span className="text-xs font-bold text-accent-gold whitespace-nowrap w-16 pt-0.5 flex-shrink-0">
                {sec.code}
              </span>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {sec.title !== sec.code ? sec.title : ""}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  {sec.relevance}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
