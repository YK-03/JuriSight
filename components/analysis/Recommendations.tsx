import { Card, CardContent } from "@/components/ui/card";

type RecommendationsProps = {
  recommendations: string[];
};

export function Recommendations({ recommendations }: RecommendationsProps) {
  return (
    <Card className="rounded-2xl border border-border bg-bg-card shadow-panel">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-4">
          Recommendations
        </h3>
      </div>
      <CardContent>
        <ul>
          {recommendations.map((rec, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-text-primary mb-2 last:mb-0"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-accent-gold mt-1.5 flex-shrink-0" />
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
