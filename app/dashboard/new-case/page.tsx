"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ArrowRight, FileSearch, Scale, ShieldAlert } from "lucide-react";

type OffenseType = "Theft" | "Assault" | "Fraud" | "Other";
type CriminalRecord = "None" | "Minor" | "Serious";
type CooperationLevel = "Fully Cooperative" | "Partial" | "Non-cooperative";
type Eligibility = "Eligible" | "Conditional" | "Not Eligible";
type RiskLevel = "Low" | "Medium" | "High";

type FormState = {
  title: string;
  description: string;
  offenseType: OffenseType;
  criminalRecord: CriminalRecord;
  cooperationLevel: CooperationLevel;
  timeServed: number | "";
};

type AnalysisResult = {
  sections: string[];
  punishment: string;
  risk: RiskLevel;
  eligibility: Eligibility;
  explanation: string;
};

const defaultForm: FormState = {
  title: "",
  description: "",
  offenseType: "Theft",
  criminalRecord: "None",
  cooperationLevel: "Fully Cooperative",
  timeServed: "",
};

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "border-neutral-200/10 bg-bg-secondary/50 text-text-secondary",
    gold: "border-accent-gold/30 bg-accent-gold/10 text-accent-gold",
    success: "border-state-success/35 bg-state-success/10 text-state-success",
    warning: "border-state-warning/35 bg-state-warning/10 text-state-warning",
    danger: "border-state-error/35 bg-state-error/10 text-state-error",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <FormField label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-neutral-200/10 bg-bg-card px-4 text-sm text-text-primary shadow-panel outline-none transition-all duration-300 focus:border-accent-gold/40"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function OutputCard({ result }: { result: AnalysisResult | null }) {
  const riskTone = {
    Low: "success",
    Medium: "warning",
    High: "danger",
  } as const;

  const eligibilityTone = {
    Eligible: "success",
    Conditional: "gold",
    "Not Eligible": "danger",
  } as const;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="h-full"
    >
      <div className="rounded-xl border border-neutral-200/10 bg-bg-card/90 p-6 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-gold">
              Live Output
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
              Legal Analysis
            </h2>
          </div>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
            <FileSearch className="h-5 w-5" />
          </span>
        </div>

        <AnimatePresence mode="wait">
          {result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 space-y-7"
            >
              <div className="flex flex-wrap gap-2">
                <Badge tone={eligibilityTone[result.eligibility]}>{result.eligibility}</Badge>
                <Badge tone={riskTone[result.risk]}>{result.risk} Risk</Badge>
              </div>

              <div className="space-y-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                  Sections
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.sections.map((section) => (
                    <Badge key={section} tone="neutral">
                      {section}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                  Punishment
                </p>
                <p className="text-sm leading-7 text-text-primary">{result.punishment}</p>
              </div>

              <div className="space-y-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">
                  Explanation
                </p>
                <p className="text-sm leading-7 text-text-secondary">{result.explanation}</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.26 }}
              className="mt-10 flex min-h-[23rem] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200/10 bg-bg-secondary/25 px-6 text-center"
            >
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
                <Scale className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight text-text-primary">
                Run analysis to see legal insights
              </h3>
              <p className="mt-3 max-w-sm text-sm leading-7 text-text-secondary">
                Your structured outcome will appear here with eligibility posture, risk scoring, relevant sections, and an AI-style explanation.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function NewCasePage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);

    await new Promise((resolve) => setTimeout(resolve, 1250));

    const risk: RiskLevel =
      form.criminalRecord === "Serious" || form.cooperationLevel === "Non-cooperative"
        ? "High"
        : form.criminalRecord === "Minor" || form.cooperationLevel === "Partial"
          ? "Medium"
          : "Low";

    const eligibility: Eligibility =
      risk === "High" ? "Not Eligible" : risk === "Medium" ? "Conditional" : "Eligible";

    const sections =
      form.offenseType === "Theft"
        ? ["IPC 379"]
        : form.offenseType === "Assault"
          ? ["IPC 351", "IPC 323"]
          : form.offenseType === "Fraud"
            ? ["IPC 420"]
            : ["IPC 378"];

    const punishment =
      form.offenseType === "Theft"
        ? "Up to 3 years or fine or both"
        : form.offenseType === "Assault"
          ? "May extend to 1 year, or fine, or both"
          : form.offenseType === "Fraud"
            ? "Up to 7 years and fine"
            : "Punishment depends on the precise statutory classification and facts presented";

    setResult({
      sections,
      punishment,
      risk,
      eligibility,
      explanation:
        form.offenseType === "Theft"
          ? "The offense involves theft of movable property. The current inputs suggest a review posture that depends on the accused's prior record, cooperation, and the time already served. On these facts, a conditional view is appropriate where risk indicators are moderate and the surrounding circumstances remain manageable."
          : form.offenseType === "Fraud"
            ? "The matter reflects an allegation involving dishonest inducement and potential financial loss. Eligibility is shaped by the gravity of the accusation, cooperation with the investigation, and any prior criminal history. The current profile suggests that the court would likely weigh custody needs against investigative progress before granting relief."
            : "The submitted facts indicate that eligibility turns on the seriousness of the allegation, the conduct of the accused during investigation, and whether custody remains necessary. The present assessment offers a cautious legal posture intended for initial internal review rather than final judicial prediction.",
    });

    setLoading(false);
  };

  return (
    <main className="grid-noise min-h-screen text-text-primary">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-6xl px-6 py-8"
      >
        <motion.section variants={itemVariants} className="mb-8">
          <div className="rounded-xl border border-neutral-200/10 bg-bg-card/75 px-6 py-6 shadow-panel backdrop-blur-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-gold">
                  Case Analysis Workspace
                </p>
                <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                  New Case Analysis
                </h1>
                <p className="max-w-2xl text-base leading-7 text-text-secondary">
                  Input case facts on the left and review a live AI-style legal output panel on the right.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/10 bg-bg-secondary/45 px-4 py-2 text-sm text-text-secondary">
                <ShieldAlert className="h-4 w-4 text-accent-gold" />
                Internal review only
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          variants={itemVariants}
          className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,1fr)]"
        >
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="rounded-xl border border-neutral-200/10 bg-bg-card/90 p-6 shadow-panel"
          >
            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-gold">
                Input Form
              </p>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
                Enter case details
              </h2>
            </div>

            <div className="mt-8 space-y-5">
              <FormField label="Case Title">
                <input
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  placeholder="State vs. Example Matter"
                  className="h-12 w-full rounded-xl border border-neutral-200/10 bg-bg-card px-4 text-sm text-text-primary shadow-panel outline-none transition-all duration-300 placeholder:text-text-secondary/70 focus:border-accent-gold/40"
                />
              </FormField>

              <FormField label="Description">
                <textarea
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  rows={6}
                  placeholder="Summarize the allegation, procedural posture, and any relevant custody context."
                  className="w-full rounded-xl border border-neutral-200/10 bg-bg-card px-4 py-3 text-sm leading-7 text-text-primary shadow-panel outline-none transition-all duration-300 placeholder:text-text-secondary/70 focus:border-accent-gold/40"
                />
              </FormField>

              <div className="grid gap-5 md:grid-cols-2">
                <SelectField
                  label="Offense Type"
                  value={form.offenseType}
                  options={["Theft", "Assault", "Fraud", "Other"]}
                  onChange={(value) => updateField("offenseType", value as OffenseType)}
                />
                <SelectField
                  label="Prior Criminal Record"
                  value={form.criminalRecord}
                  options={["None", "Minor", "Serious"]}
                  onChange={(value) => updateField("criminalRecord", value as CriminalRecord)}
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <SelectField
                  label="Cooperation Level"
                  value={form.cooperationLevel}
                  options={["Fully Cooperative", "Partial", "Non-cooperative"]}
                  onChange={(value) => updateField("cooperationLevel", value as CooperationLevel)}
                />
                <FormField label="Time Served (months)">
                  <input
                    type="number"
                    min="0"
                    value={form.timeServed}
                    onChange={(event) =>
                      updateField("timeServed", event.target.value === "" ? "" : Number(event.target.value))
                    }
                    placeholder="0"
                    className="h-12 w-full rounded-xl border border-neutral-200/10 bg-bg-card px-4 text-sm text-text-primary shadow-panel outline-none transition-all duration-300 placeholder:text-text-secondary/70 focus:border-accent-gold/40"
                  />
                </FormField>
              </div>

              <motion.button
                type="button"
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleAnalyze}
                disabled={loading}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-accent-gold/70 bg-accent-gold px-5 font-medium text-bg-primary transition-all duration-300 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-80"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={loading ? "loading" : "idle"}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="inline-flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg-primary/40 border-t-bg-primary" />
                        Analyzing Case...
                      </>
                    ) : (
                      <>
                        Analyze Case
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </div>
          </motion.div>

          <div className="xl:sticky xl:top-8 xl:self-start">
            <OutputCard result={result} />
          </div>
        </motion.section>
      </motion.div>
    </main>
  );
}
