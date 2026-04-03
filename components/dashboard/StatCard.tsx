"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
    >
      <Card className="rounded-xl border border-neutral-200/10 bg-bg-card/90 shadow-panel transition-all duration-300 hover:border-accent-gold/30">
        <CardContent className="space-y-3 px-6 py-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-secondary">
            {label}
          </p>
          <p className="font-display text-4xl font-semibold tracking-tight text-text-primary">
            {value}
          </p>
          {description ? <p className="max-w-xs text-sm leading-6 text-text-secondary">{description}</p> : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}
