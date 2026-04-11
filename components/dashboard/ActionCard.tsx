import type { Route } from "next";
import Link from "next/link";
import { ReactNode } from "react";

interface ActionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  href?: Route;
  onClick?: () => void;
}

export function ActionCard({ title, description, icon, href, onClick }: ActionCardProps) {
  const className =
    "flex items-start gap-4 rounded-2xl border border-border/40 bg-bg-card p-5 text-left transition-all group hover:border-border/80 hover:bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-accent-gold/10";

  const content = (
    <>
      <div className="p-2.5 rounded-xl bg-bg-secondary text-text-secondary group-hover:text-text-primary transition-colors">
        {icon}
      </div>
      <div className="flex flex-col gap-1.5 pt-0.5">
        <h3 className="font-medium text-sm text-text-primary group-hover:text-text-primary transition-colors">{title}</h3>
        <p className="text-sm text-text-secondary leading-snug">
          {description}
        </p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
