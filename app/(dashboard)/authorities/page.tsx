"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Row = {
  id: string;
  accusedName: string;
  section: string;
  status: string;
  createdAt: string;
  dateOfArrest: string | null;
  maximumSentenceYears: number | null;
  analysis: null | {
    riskScore: number;
    eligibilityStatus: "LIKELY_ELIGIBLE" | "LIKELY_INELIGIBLE" | "BORDERLINE";
  };
};

const WarningIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export default function AuthoritiesPage() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<Row[]>([]);
  const [riskFilter, setRiskFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sort, setSort] = useState("Highest Risk");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/cases");
      const data = (await res.json()) as Row[];
      setRows(data);
    })();
  }, []);

  const enriched = useMemo(
    () =>
      rows.map((r) => {
        const risk = r.analysis?.riskScore ?? 0;
        const arrest = r.dateOfArrest ? new Date(r.dateOfArrest) : null;
        const served = arrest ? Math.floor((Date.now() - arrest.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const maxDays = (r.maximumSentenceYears ?? 0) * 365;
        const percent = maxDays ? (served / maxDays) * 100 : 0;
        return { ...r, risk, served, percent };
      }),
    [rows],
  );

  const filtered = useMemo(() => {
    let list = [...enriched];
    if (riskFilter !== "All") {
      list = list.filter((r) => {
        if (riskFilter === "Low") return r.risk <= 3;
        if (riskFilter === "Moderate") return r.risk >= 4 && r.risk <= 6;
        return r.risk >= 7;
      });
    }
    if (statusFilter !== "All") {
      list = list.filter((r) => {
        if (statusFilter === "Eligible") return r.analysis?.eligibilityStatus === "LIKELY_ELIGIBLE";
        return r.status === statusFilter.toUpperCase();
      });
    }
    if (sort === "Newest") list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (sort === "Oldest") list.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    if (sort === "Highest Risk") list.sort((a, b) => b.risk - a.risk);
    if (sort === "Most Time Served") list.sort((a, b) => b.served - a.served);
    return list;
  }, [enriched, riskFilter, statusFilter, sort]);

  const alertCount = filtered.filter((r) => r.percent >= 50).length;
  const avgServed = filtered.length ? Math.round(filtered.reduce((sum, r) => sum + r.served, 0) / filtered.length) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-[#0A2540]">Undertrial Management Dashboard</h1>
        <p className="text-sm text-[#8898AA]">Real-time bail eligibility and risk monitoring</p>
      </div>

      {alertCount > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-5 py-3 text-[#92400E]">
          <WarningIcon />
          <span>{alertCount} undertrial(s) have crossed 50% of maximum sentence - Immediate bail review recommended</span>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Total Undertrials</p><p className="text-2xl font-bold">{filtered.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Eligible for Review</p><p className="text-2xl font-bold">{filtered.filter((r) => r.percent >= 50).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">High Risk</p><p className="text-2xl font-bold">{filtered.filter((r) => r.risk >= 7).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-text-secondary">Avg Time Served</p><p className="text-2xl font-bold">{avgServed}d</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="rounded border p-2" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}><option>All</option><option>Low</option><option>Moderate</option><option>High</option></select>
        <select className="rounded border p-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All</option><option>Pending</option><option>Analyzed</option><option>Eligible</option></select>
        <select className="rounded border p-2" value={sort} onChange={(e) => setSort(e.target.value)}><option>Newest</option><option>Oldest</option><option>Highest Risk</option><option>Most Time Served</option></select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary">
            <tr className="text-left">
              {[
                "Name", "Section", "Risk Score", "Time Served", "% of Sentence", "Eligibility", "Last Analysis", "Action",
              ].map((h) => <th key={h} className="p-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={r.percent >= 50 ? "bg-red-50" : r.percent >= 33 ? "bg-amber-50" : ""}>
                <td className="p-3">{r.accusedName}</td>
                <td className="p-3">{r.section}</td>
                <td className="p-3"><Badge variant={r.risk <= 3 ? "success" : r.risk <= 6 ? "warning" : "error"}>{r.risk}</Badge></td>
                <td className="p-3">{r.served} days</td>
                <td className="p-3">
                  <div className="h-2 w-40 rounded bg-[#E5E7EB]"><div className={r.percent >= 50 ? "h-2 rounded bg-red-500" : r.percent >= 33 ? "h-2 rounded bg-amber-500" : "h-2 rounded bg-green-500"} style={{ width: `${Math.min(100, r.percent)}%` }} /></div>
                </td>
                <td className="p-3">{r.analysis?.eligibilityStatus ?? "-"}</td>
                <td className="p-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="p-3"><Button asChild size="sm"><Link href={`/cases/${r.id}`}>Review</Link></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
