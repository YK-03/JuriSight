import { Card, CardContent } from "@/components/ui/card";

type RecommendationsProps = {
  recommendations: string[];
};

export function Recommendations({ recommendations }: RecommendationsProps) {
  return (
    <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold tracking-widest text-gray-400 dark:text-gray-500 uppercase mb-4">
          Recommendations
        </h3>
      </div>
      <CardContent>
        <ul>
          {recommendations.map((rec, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2 last:mb-0"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
