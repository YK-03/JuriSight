import type { ReactNode } from "react";
import { LanguageProvider } from "@/lib/language-context";
import { Navbar } from "@/components/app/Navbar";
import { Sidebar } from "@/components/app/Sidebar";
import { AppToaster } from "@/components/ui/toast";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <div className="grid-noise min-h-screen bg-bg-primary">
        <Navbar />
        <div className="mx-auto flex max-w-7xl">
          <Sidebar />
          <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
        <AppToaster />
      </div>
    </LanguageProvider>
  );
}
