import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type RiskFactor = {
  label: string;
  severity: "High" | "Medium" | "Low";
  description: string;
};

type RiskFactorsProps = {
  riskFactors: RiskFactor[];
};

function getSeverityColor(severity: string) {
  switch (severity) {
    case "High":
      return "bg-state-error/10 text-state-error border border-state-error/30 text-xs font-semibold px-2 py-0.5 rounded";
    case "Medium":
      return "bg-state-warning/10 text-state-warning border border-state-warning/30 text-xs font-semibold px-2 py-0.5 rounded";
    case "Low":
      return "bg-state-success/10 text-state-success border border-state-success/30 text-xs font-semibold px-2 py-0.5 rounded";
    default:
      return "bg-bg-secondary text-text-secondary border border-border text-xs font-semibold px-2 py-0.5 rounded";
  }
}

export function RiskFactors({ riskFactors }: RiskFactorsProps) {
  return (
    <Card className="rounded-2xl border border-border bg-bg-card shadow-panel h-auto min-h-0">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-4">
          Overview &amp; Risk Factors
        </h3>
      </div>
      <CardContent>
        <ul>
          {riskFactors.map((factor, i) => (
            <li
              key={i}
              className="flex flex-col gap-1.5 border-b border-border/40 pb-3 mb-3 last:border-0 last:pb-0 last:mb-0"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-text-primary">
                  {factor.label}
                </span>
                <Badge variant="outline" className={getSeverityColor(factor.severity)}>
                  {factor.severity}
                </Badge>
              </div>
              <p className="text-sm text-text-secondary">
                {factor.description}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
