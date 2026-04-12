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
      return "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-semibold px-2 py-0.5 rounded border-0";
    case "Medium":
      return "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-xs font-semibold px-2 py-0.5 rounded border-0";
    case "Low":
      return "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-xs font-semibold px-2 py-0.5 rounded border-0";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-semibold px-2 py-0.5 rounded border-0";
  }
}

export function RiskFactors({ riskFactors }: RiskFactorsProps) {
  return (
    <Card className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm h-auto min-h-0">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold tracking-widest text-gray-400 dark:text-gray-500 uppercase mb-4">
          Overview &amp; Risk Factors
        </h3>
      </div>
      <CardContent>
        <ul>
          {riskFactors.map((factor, i) => (
            <li
              key={i}
              className="flex flex-col gap-1.5 border-b border-gray-100 dark:border-gray-800 pb-3 mb-3 last:border-0 last:pb-0 last:mb-0"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {factor.label}
                </span>
                <Badge variant="outline" className={getSeverityColor(factor.severity)}>
                  {factor.severity}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {factor.description}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
