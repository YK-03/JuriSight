import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";;

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-border bg-bg-secondary px-3 text-sm text-text-primary outline-none transition focus:border-accent-gold",
        className,
      )}
      {...props}
    />
  );
}
