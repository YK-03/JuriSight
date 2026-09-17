import { ReactNode } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center selection:bg-accent/20">
      <DashboardHeader />
      {children}
    </div>
  );
}
