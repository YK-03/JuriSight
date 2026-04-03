"use client";

import { motion, type Variants } from "framer-motion";
import type { DashboardData } from "@/lib/dashboard-data";
import { CaseUploadZone } from "@/components/dashboard/CaseUploadZone";
import { CaseRow } from "@/components/dashboard/CaseRow";

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.06,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } },
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardOverview({ data }: { data: DashboardData }) {
  const { userName, stats, recentCases } = data;

  const metrics = [
    { label: "Total Cases", value: stats.totalCases },
    { label: "Analyzed", value: stats.analyzedCases },
    { label: "Avg Risk Score", value: stats.avgRiskScore ?? "—" },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-8 pb-8">
      <motion.section variants={itemVariants} className="space-y-1">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-text-primary">
          {getGreeting()}, {userName}.
        </h1>
        <p className="text-base text-text-secondary">You have {stats.pendingCases} pending cases.</p>
      </motion.section>

      <motion.section variants={itemVariants} className="rounded-3xl bg-bg-card/60 p-6 shadow-panel">
        <CaseUploadZone />
      </motion.section>

      <motion.section variants={itemVariants} className="grid gap-3 md:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl bg-bg-secondary px-5 py-4 text-white">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">{metric.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-text-primary">{metric.value}</p>
          </div>
        ))}
      </motion.section>

      <motion.section variants={itemVariants} className="space-y-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-text-primary">Your cases</h2>
        <div className="overflow-x-auto rounded-2xl bg-bg-card/60 shadow-panel">
          <table className="min-w-[760px] w-full">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">Case title</th>
                <th className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">Section</th>
                <th className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">Status</th>
                <th className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">Eligibility</th>
                <th className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentCases.length > 0 ? (
                recentCases.map((caseItem) => <CaseRow key={caseItem.id} caseItem={caseItem} />)
              ) : (
                <tr className="border-t border-border/60">
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-secondary">
                    No cases yet. Use the area above to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.section>
    </motion.div>
  );
}
