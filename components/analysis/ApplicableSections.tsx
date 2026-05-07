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
    <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold tracking-widest text-gray-400 dark:text-gray-500 uppercase mb-4">
          Applicable Sections
        </h3>
      </div>
      <CardContent>
        <ul>
          {sections.map((sec, i) => (
            <li
              key={i}
              className="flex items-start gap-3 pb-3 mb-3 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0 last:mb-0"
            >
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap w-16 pt-0.5 flex-shrink-0">
                {sec.code}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {sec.title !== sec.code ? sec.title : ""}
                </p><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
