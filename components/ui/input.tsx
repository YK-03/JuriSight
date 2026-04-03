import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";;

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-border bg-bg-secondary px-3 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-accent-gold",
        className,
      )}
      {...props}
    />
  );
}
