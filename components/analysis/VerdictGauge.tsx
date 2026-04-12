import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type VerdictGaugeProps = {
  verdict: "Favorable" | "Unfavorable" | "Mixed";
  riskScore: number;
  summary: string;
  biasWarning: string | null;
};

const circumference = 2 * Math.PI * 40;

function getVerdictColor(verdict: string) {
  switch (verdict) {
    case "Favorable":
      return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800";
    case "Unfavorable":
      return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800";
    case "Mixed":
    default:
      return "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
  }
}

export function VerdictGauge({ verdict, riskScore, summary, biasWarning }: VerdictGaugeProps) {
  const score = riskScore;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const gaugeStrokeColor =
    score > 70 ? "#ef4444" : score >= 40 ? "#f59e0b" : "#22c55e";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xs font-semibold tracking-widest text-gray-400 dark:text-gray-500 uppercase mb-4">
            Analysis Summary
          </h3>
        </div>
        <div className="px-5 py-4 space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge
              variant="outline"
              className={`text-xs font-semibold tracking-widest px-3 py-1 rounded-full ${getVerdictColor(verdict)}`}
            >
              {`${verdict || "Unknown"} VERDICT`}
            </Badge>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
            {summary}
          </p>
          {biasWarning && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 rounded-xl flex gap-3 items-start text-red-800 dark:text-red-200 text-sm">
              <svg className="w-5 h-5 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <p>{biasWarning}</p>
            </div>
          )}
        </div>
      </Card>

      <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-6 text-center">
        <CardContent className="flex flex-col items-center justify-center h-full p-0">
          <h3 className="text-xs font-semibold tracking-widest text-gray-400 dark:text-gray-500 uppercase mb-4">
            Risk Score
          </h3>
          <div className="relative w-48 h-24 overflow-hidden mb-2">
            <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="rgb(229 231 235)"
                strokeWidth="10"
                strokeLinecap="round"
                className="dark:stroke-gray-700"
              />
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke={gaugeStrokeColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">{score}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">out of 100</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
