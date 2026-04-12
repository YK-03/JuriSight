"use client";

import Image from "next/image";
import type { Route } from "next";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { H1, H2, H3, Lead, Muted, P, Small } from "../components/ui/typography";
import { Logo } from "../components/app/Logo";
import { ThemeToggle } from "../components/app/ThemeToggle";
import { SignInButton, Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function LandingPage() {
  const currentYear = new Date().getFullYear();

  return (
    <main className="grid-noise min-h-screen text-text-primary">
      <section className="mx-auto max-w-7xl px-6 pb-24 pt-20">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button variant="outline" size="sm" className="hidden sm:inline-flex border-accent-gold/40 hover:bg-accent-gold/10">Sign In</Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex border-accent-gold/40 hover:bg-accent-gold/10">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <UserButton />
            </Show>
          </div>
        </div>
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Small className="mb-4 block font-mono uppercase tracking-[0.28em] text-accent-gold">Legal Decision Support</Small>
            <H1 className="max-w-4xl font-display text-5xl leading-tight md:text-7xl">Legal Intelligence For Indian Criminal Cases</H1>
            <Lead className="mt-6 max-w-2xl">
              Case analysis, risk scoring, applicable IPC/BNS sections, legal precedents, and AI chat </Lead>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="inline-flex h-11 items-center rounded-md border border-accent-gold/70 bg-accent-gold px-5 font-semibold text-bg-primary transition-all duration-300 hover:brightness-105">
                <Link href={"/sign-up" as Route}>Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/how-it-works">See How It Works</Link>
              </Button>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[13px] text-text-secondary">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <a
              href="/guest"
              className="mt-2 block text-center text-sm text-accent-gold underline underline-offset-4 transition-colors hover:text-accent-gold/80"
            >
              Try a free eligibility check - no account needed
            </a>
          </div>
          <div className="justice-hover panel relative overflow-hidden p-2">
            <div className="justice-photo relative overflow-hidden rounded-md">
              <Image
                src="/lady-justice.png"
                alt="Lady Justice"
                width={1080}
                height={1920}
                className="h-[26rem] w-full rounded-md object-cover object-top [filter:grayscale(78%)_contrast(1.02)_brightness(0.92)] transition-transform duration-500"
                priority
              />
            </div>
            <div className="px-2 pb-2 pt-3">
              <Muted className="font-mono uppercase tracking-[0.16em] text-accent-gold">Symbol of impartial justice</Muted>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-20 md:grid-cols-3">
        {[
          ["CASE ANALYSIS ENGINE", "Structured evaluation of case merits, risks, and likely outcomes under IPC, BNS, and CrPC sections."],
          ["RISK FACTOR ANALYSIS", "Offense severity, evidence exposure, community ties, and bias indicators - scored and explained."],
          ["LEGAL REASONING & PRECEDENTS", "Applicable IPC/BNS sections with relevant Supreme Court precedents and actionable recommendations."],
        ].map(([title, body]) => (
          <Card key={title} className="fx-card group">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <Muted>{body}</Muted>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <Card>
          <CardHeader>
            <CardTitle>Sample Output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="error">UNFAVORABLE VERDICT</Badge>
              <Badge variant="error">RISK SCORE: 85/100</Badge>
            </div>
            <P className="mt-0 text-sm text-text-primary">
              An employee faces charges under IPC 406 and IPC 420 for alleged financial misappropriation. Strong prosecution case with limited defense options without forensic evidence.
            </P>
            <P className="mt-0 text-sm text-text-secondary italic">
              High confidence - strong precedent match across multiple Supreme Court judgments.
            </P>
            <div className="flex flex-wrap gap-2">
              <Badge variant="error">OFFENSE SEVERITY: HIGH</Badge>
              <Badge variant="error">EVIDENCE EXPOSURE: HIGH</Badge>
              <Badge variant="outline">APPLICABLE: IPC 406, IPC 420, BNS 316, BNS 318</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">PRIMARY SECTION: IPC 406</Badge>
              <Badge variant="outline">APPLICABLE LAWS: IPC, BNS, CrPC</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-6 pb-24">
        <H2 className="mb-6 border-0 pb-0 font-display text-3xl">How It Works</H2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["1", "Input Case Data", "Enter complete case facts, profile, and offense narrative."],
            ["2", "AI Analysis", "AI evaluates case posture with structured risk scoring."],
            ["3", "Review Assessment", "Inspect recommendation, reasoning, and applicable sections."],
          ].map(([n, t, d]) => (
            <Card key={t} className="fx-card group">
              <CardContent className="space-y-2 py-6">
                <Small className="font-mono text-accent-gold">STEP {n}</Small>
                <H3 className="text-xl font-medium">{t}</H3>
                <Muted>{d}</Muted>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="disclaimer-fx panel relative overflow-hidden p-6">
          <div className="relative z-10">
            <Small className="mb-2 block font-mono uppercase tracking-[0.2em] text-accent-gold">Disclaimer</Small>
            <P className="mt-0 text-sm text-text-secondary">
              JuriSight provides AI-assisted legal decision support for institutional review only. It is not legal advice,
              does not create an advocate-client relationship, and must not replace independent judicial or professional legal judgment.
            </P>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-sm text-text-secondary">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 font-mono uppercase tracking-[0.16em]">
          <span className="text-accent-gold">JuriSight</span>
          <span className="text-text-secondary/60">&bull;</span>
          <span>{currentYear}</span>
          <span className="text-text-secondary/60">&bull;</span>
          <span>All Rights Reserved</span>
        </div>
      </footer>
    </main>
  );
}
