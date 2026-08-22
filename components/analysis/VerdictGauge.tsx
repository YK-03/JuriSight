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
      return "bg-state-success/10 text-state-success border border-state-success/30";
    case "Unfavorable":
      return "bg-state-error/10 text-state-error border border-state-error/30";
    case "Mixed":
    default:
      return "bg-state-warning/10 text-state-warning border border-state-warning/30";
  }
}

export function VerdictGauge({ verdict, riskScore, summary, biasWarning }: VerdictGaugeProps) {
  const score = riskScore;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const gaugeStrokeColor =
    score > 70 ? "rgb(var(--state-error))" : score >= 40 ? "rgb(var(--state-warning))" : "rgb(var(--state-success))";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 rounded-2xl border border-border bg-bg-card shadow-panel">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-4">
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
          <p className="text-text-primary text-sm leading-relaxed">
            {summary}
          </p>
          {biasWarning && (
            <div className="p-4 bg-state-error/10 border border-state-error/30 rounded-xl flex gap-3 items-start text-state-error text-sm">
              <svg className="w-5 h-5 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <p className="text-text-primary">{biasWarning}</p>
            </div>
          )}
        </div>
      </Card>

      <Card className="rounded-2xl border border-border bg-bg-card shadow-panel p-6 text-center">
        <CardContent className="flex flex-col items-center justify-center h-full p-0">
          <h3 className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-4">
            Risk Score
          </h3>
          <div className="relative w-48 h-24 overflow-hidden mb-2">
            <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="rgb(var(--border-default) / 0.14)"
                strokeWidth="10"
                strokeLinecap="round"
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
              <span className="text-4xl font-bold text-text-primary">{score}</span>
              <span className="text-xs text-text-secondary mt-1">out of 100</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
