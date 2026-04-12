import { Card, CardContent } from "@/components/ui/card";

type Precedent = {
  case: string;
  citation: string;
  relevance: string;
};

type PrecedentsProps = {
  precedents: Precedent[];
};

export function Precedents({ precedents }: PrecedentsProps) {
  return (
    <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold tracking-widest text-gray-400 dark:text-gray-500 uppercase mb-4">
          Precedents
        </h3>
      </div>
      <CardContent>
        <ul>
          {precedents.map((prec, i) => (
            <li
              key={i}
              className="flex flex-col gap-1.5 pb-3 mb-3 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0 last:mb-0"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {prec.case}
                </span>
                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded ml-2">
                  {prec.citation}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                {prec.relevance}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
