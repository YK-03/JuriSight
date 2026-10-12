import { ReactNode } from "react";
import { DashboardAppShell } from "@/components/dashboard/DashboardAppShell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardAppShell>{children}</DashboardAppShell>;
}
