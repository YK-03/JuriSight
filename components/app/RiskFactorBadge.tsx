import { Badge } from "@/components/ui/badge";

const riskMap: Record<string, "success" | "warning" | "error" | "default"> = {
  LOW: "success",
  MODERATE: "warning",
  MEDIUM: "warning",
  HIGH: "error",
  SEVERE: "error",
  STRONG: "success",
  WEAK: "error",
};

export function RiskFactorBadge({ value }: { value: string }) {
  return <Badge variant={riskMap[value] ?? "default"}>{value}</Badge>;
}