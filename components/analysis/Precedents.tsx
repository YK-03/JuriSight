import { buildSearchLink, normalizePrecedents, type Precedent } from "@/lib/precedents";
import { Card, CardContent } from "@/components/ui/card";

type PrecedentsProps = {
  precedents: Array<Precedent | Record<string, unknown>>;
};

export function Precedents({ precedents }: PrecedentsProps) {
  const safePrecedents = normalizePrecedents(precedents).map((precedent) => ({
    ...precedent,
    searchLink: precedent.searchLink || buildSearchLink(precedent.case),
  }));

  return (
    <Card className="rounded-2xl border border-border bg-bg-card shadow-panel">
      <div className="border-b border-border px-5 py-4">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-secondary">
          Precedents
        </h3>
      </div>
      <CardContent>
        <ul>
          {safePrecedents.map((precedent, index) => (
            <li
              key={`${precedent.case}-${index}`}
              className="mb-3 flex flex-col gap-1.5 border-b border-border/40 pb-3 last:mb-0 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={precedent.searchLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-text-primary underline decoration-accent-gold/40 underline-offset-4 transition hover:text-accent-gold"
                >
                  {precedent.case}
                </a>
                <a
                  href={precedent.searchLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-accent-gold/30 bg-accent-gold/10 px-1.5 py-0.5 text-xs text-accent-gold transition hover:bg-accent-gold/20"
                >
                  View Source
                </a>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                {precedent.principle}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
