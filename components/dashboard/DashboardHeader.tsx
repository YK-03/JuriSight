import { UserButton } from "@clerk/nextjs";
import { Logo } from "../app/Logo";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-50 w-full bg-bg-primary/80 backdrop-blur-md border-b border-border/40">
      <div className="container max-w-5xl mx-auto flex h-16 items-center justify-between px-4">
        <Logo compact />
        <div className="flex items-center gap-4">
          <UserButton />
        </div>
      </div>
    </header>
  );
}
