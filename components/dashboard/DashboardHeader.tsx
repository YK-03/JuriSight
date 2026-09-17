import { UserButton } from "@clerk/nextjs";
import { Logo } from "../app/Logo";
import { ThemeToggle } from "../app/ThemeToggle";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-50 w-full bg-bg-primary/80 backdrop-blur-md border-b border-border/40">
      <div className="container max-w-5xl mx-auto flex h-16 items-center justify-between px-4">
        <Logo compact />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="hidden text-xs font-mono uppercase tracking-[0.16em] text-text-secondary sm:inline">
            Your workspace
          </span>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/45 bg-bg-card p-0.5 shadow-panel transition-all duration-200 hover:border-accent">
            <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
          </div>
        </div>
      </div>
    </header>
  );
}
