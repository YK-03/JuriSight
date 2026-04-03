"use client";

import Link from "next/link";
import type { Route } from "next";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export function DashboardCard({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: Route;
  icon: LucideIcon;
}) {
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.015 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="h-full"
    >
      <Link href={href} className="block h-full cursor-pointer">
        <Card className="group flex h-full min-h-[210px] rounded-xl border border-neutral-200/10 bg-bg-card/90 p-6 shadow-panel transition-all duration-300 hover:border-accent-gold/35 hover:shadow-[0_0_0_1px_rgba(201,168,76,0.18),0_18px_38px_rgba(17,24,39,0.14)]">
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-accent-gold/20 bg-accent-gold/10 text-accent-gold transition-colors duration-300 group-hover:border-accent-gold/40">
                <Icon className="h-5 w-5" />
              </span>
              <ArrowUpRight className="h-4 w-4 text-text-secondary transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-gold" />
            </div>
            <div className="mt-12 space-y-3">
              <h3 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
                {title}
              </h3>
              <p className="max-w-sm text-sm leading-6 text-text-secondary">{description}</p>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
