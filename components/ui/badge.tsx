import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";;

const variants = {
  default: "bg-bg-secondary text-text-secondary border-border",
  outline: "bg-transparent text-text-primary border-border",
  success: "bg-state-success/10 text-state-success border-state-success/50",
  warning: "bg-state-warning/10 text-state-warning border-state-warning/50",
  error: "bg-state-error/10 text-state-error border-state-error/50",
  gold: "bg-accent-gold/10 text-accent-gold border-accent-gold/50",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 font-mono text-xs uppercase tracking-wide",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
