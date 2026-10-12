import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-full min-w-0 w-full flex-1 flex-col overflow-x-hidden font-sans antialiased text-text-primary",
        className,
      )}
    >
      {children}
    </div>
  );
}
