"use client";

import { useUser, SignOutButton, Show } from "@clerk/nextjs";
import { Logo } from "@/components/app/Logo";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { LanguageToggle } from "@/components/app/LanguageToggle";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { user, isLoaded, isSignedIn } = useUser();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg-primary/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Logo href="/" compact />
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
          <Show when="signed-in">
            {isLoaded && isSignedIn && user && (
              <>
                <SignOutButton>
                  <Button variant="outline" size="sm">
                    Sign Out
                  </Button>
                </SignOutButton>
              </>
            )}
          </Show>
        </div>
      </div>
    </header>
  );
}
