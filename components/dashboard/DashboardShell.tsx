import { ReactNode } from "react";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen w-full font-sans antialiased text-text-primary">
      {children}
    </div>
  );
}
