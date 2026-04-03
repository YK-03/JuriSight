import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Merriweather_Sans } from "next/font/google";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "../components/app/Providers";
import "./globals.css";

const brand = Merriweather_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  fallback: ["system-ui", "arial"],
  variable: "--font-brand",
});

export const metadata: Metadata = {
  title: "JuriSight",
  description: "Institutional bail analysis support under Indian CrPC",
  icons: {
    icon: [
      { url: "/icon.svg?v=3", type: "image/svg+xml" },
    ],
    shortcut: ["/icon.svg?v=3"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const themeInit = `
    (function () {
      try {
        var saved = localStorage.getItem('theme');
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var shouldDark = saved ? saved === 'dark' : prefersDark;
        document.documentElement.classList.toggle('dark', shouldDark);
      } catch (e) {}
    })();
  `;

  return (
    <ClerkProvider
      afterSignOutUrl="/"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <html lang="en" suppressHydrationWarning>
        <head />
        <body className={`${brand.variable} bg-bg-primary font-body text-text-primary antialiased`}>
          <Script id="theme-init" strategy="beforeInteractive">
            {themeInit}
          </Script>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
