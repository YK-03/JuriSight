import Link from "next/link";
import type { Route } from "next";
import type { CaseWithAnalysis } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function statusVariant(status: string): "warning" | "success" | "error" {
  if (status === "ANALYZED") return "success";
  if (status === "CLOSED") return "error";
  return "warning";
}

export function CaseCard({ data }: { data: CaseWithAnalysis }) {
  return (
    <Card className="transition hover:border-border-hover">
      <CardContent className="space-y-3 py-5">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">{data.title}</h4>
          <Badge variant={statusVariant(data.status)}>{data.status}</Badge>
        </div>
        <p className="text-sm text-text-secondary">
          {data.accusedName} | CrPC {data.section} | {data.offenseType}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">{new Date(data.createdAt).toLocaleDateString()}</span>
          <Link href={`/cases/${data.id}` as Route} className="text-sm text-accent-gold hover:underline">
            View Case
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
