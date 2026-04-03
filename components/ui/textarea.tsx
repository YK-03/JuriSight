import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";;

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-accent-gold",
        className,
      )}
      {...props}
    />
  );
}
