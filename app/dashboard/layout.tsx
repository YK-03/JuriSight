import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center selection:bg-accent-gold/20">
      {children}
    </div>
  );
}
