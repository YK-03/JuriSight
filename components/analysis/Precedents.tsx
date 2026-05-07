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
    <Card className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Precedents
        </h3>
      </div>
      <CardContent>
        <ul>
          {safePrecedents.map((precedent, index) => (
            <li
              key={`${precedent.case}-${index}`}
              className="mb-3 flex flex-col gap-1.5 border-b border-gray-100 pb-3 last:mb-0 last:border-0 last:pb-0 dark:border-gray-800"
            >
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={precedent.searchLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-700 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-900 dark:text-blue-300 dark:decoration-blue-700 dark:hover:text-blue-200"
                >
                  {precedent.case}
                </a>
                <a
                  href={precedent.searchLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70"
                >
                  View Source
                </a>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                {precedent.principle}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
