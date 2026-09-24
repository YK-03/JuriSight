import { hasDeterministicSectionRule, type LegalRuleIdentity, type LegalStatute } from "./legal-rules";
import { inferLegalFrameworkFromSections, type LegalFramework } from "./legal-framework";

export type Statute = LegalStatute;
export type StatutePrefix = Exclude<Statute, "UNKNOWN">;
export type BailCourtLevel = "MAGISTRATE" | "SESSIONS" | "HIGH_COURT" | "UNSPECIFIED";
export const BAIL_COURT_LEVELS = ["MAGISTRATE", "SESSIONS", "HIGH_COURT", "UNSPECIFIED"] as const satisfies readonly BailCourtLevel[];

export function isBailCourtLevel(value: unknown): value is BailCourtLevel {
  return typeof value === "string" && (BAIL_COURT_LEVELS as readonly string[]).includes(value);
}

export function resolveBailCourtLevel(explicit: unknown, persisted: unknown): BailCourtLevel | undefined {
  if (isBailCourtLevel(explicit)) return explicit;
  if (isBailCourtLevel(persisted)) return persisted;
  return undefined;
}

export type ParsedSection = {
  statute: Statute;
  code: string;
  subsection?: string;
  display: string;
  resolution: "explicit" | "framework-inferred" | "ambiguous";
  frameworkConflict: boolean;
};

export type ApplicableSectionEntry = {
  code: string;
  title: string;
  relevance: string;
  source: "supplied" | "procedural" | "deterministic" | "inferred" | "unresolved";
};

const CODE_RE = /^(\d+[A-Za-z]*)$/;
const CODE_IN_TEXT_RE = /(\d+[A-Za-z]*)/;
const PROCEDURAL_CRPC = new Set(["437", "438", "439", "167", "167A", "41A"]);

export function parseSuppliedSections(
  raw: string,
  framework?: LegalFramework,
): { forRules: string[]; ruleIdentities: LegalRuleIdentity[]; suppliedRaw: string[]; parsed: ParsedSection[] } {
  if (!raw || !raw.trim() || /^not specified/i.test(raw.trim())) {
    return { forRules: [], ruleIdentities: [], suppliedRaw: [], parsed: [] };
  }

  const effectiveFramework = framework ?? inferLegalFrameworkFromSections(raw);
  const cleaned = raw
    .replace(/\((?!\s*\d+[A-Za-z]*\s*\))[^)]*\)/g, " ")
    .replace(/\band\b/gi, ",")
    .replace(/\bu\/s\b/gi, " ");
  const parsed: ParsedSection[] = [];
  const seen = new Set<string>();
  let currentPrefix: Statute = "UNKNOWN";
  let hasExplicitPrefix = false;

  for (const rawToken of cleaned.split(/[,;\/\n]+/)) {
    const token = rawToken.trim();
    if (!token) continue;

  const prefixMatch = token.match(/^(IPC|BNS|CRPC|CrPC|BNSS|NDPS|PMLA)\s+(?:Sections?\s+)?(.*)$/i);
    let remainder = token;
    let statute: Statute = "UNKNOWN";
    let resolution: ParsedSection["resolution"] = "explicit";

    if (prefixMatch) {
      const marker = prefixMatch[1].toUpperCase();
      statute = marker === "CRPC" ? "CRPC" : (marker as StatutePrefix);
      remainder = (prefixMatch[2] || "").trim();
      currentPrefix = statute;
      hasExplicitPrefix = true;
    } else {
      remainder = token.replace(/^sections?\s+/i, "").trim();
      if (hasExplicitPrefix) {
        statute = currentPrefix;
        resolution = "explicit";
      } else {
        resolution = effectiveFramework === "LEGACY_IPC_CRPC" ? "framework-inferred" : "ambiguous";
        statute = effectiveFramework === "LEGACY_IPC_CRPC" ? "IPC" : "UNKNOWN";
        currentPrefix = statute;
      }
    }

    const identityMatch = remainder.match(/^(\d+[A-Za-z]*)\s*(?:\(\s*([^)]+?)\s*\))?/);
    const codeMatch = identityMatch || remainder.match(CODE_IN_TEXT_RE);
    if (!codeMatch) continue;
    const code = codeMatch[1].toUpperCase();
    if (!CODE_RE.test(code)) continue;
    const subsection = identityMatch?.[2]?.trim().toUpperCase();

    const key = `${statute}:${code}${subsection ? `:${subsection}` : ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const suffix = subsection ? `(${subsection})` : "";
    const display = statute === "UNKNOWN" ? `Unspecified ${code}${suffix}` : statute === "CRPC" ? `CrPC ${code}${suffix}` : `${statute} ${code}${suffix}`;
    const frameworkConflict =
      (effectiveFramework === "LEGACY_IPC_CRPC" && (statute === "BNS" || statute === "BNSS")) ||
      (effectiveFramework === "CURRENT_BNS_BNSS" && (statute === "IPC" || statute === "CRPC"));

    parsed.push({ statute, code, subsection, display, resolution, frameworkConflict });
  }

  const ruleIdentities: LegalRuleIdentity[] = parsed
    .filter((section) =>
      (section.statute === "IPC" || section.statute === "BNS" || section.statute === "NDPS" || section.statute === "PMLA") &&
      section.resolution !== "ambiguous" &&
      !section.frameworkConflict,
    )
    .map((section) => ({ statute: section.statute, section: section.code, subsection: section.subsection }));

  const forRules = ruleIdentities
    .filter((section) => section.statute === "IPC")
    .map((section) => section.section);
  return { forRules, ruleIdentities, suppliedRaw: parsed.map((section) => section.display), parsed };
}

export function formatAuthoritativeSectionsBlock(suppliedRaw: string[]): string {
  if (suppliedRaw.length === 0) return "AUTHORITATIVE SUPPLIED SECTIONS: none declared by the user.";
  return [
    "AUTHORITATIVE SUPPLIED SECTIONS (DO NOT DROP, REPLACE, OR SHRINK THIS LIST):",
    suppliedRaw.join(", "),
    "These sections were declared on intake. The backend preserves them independently of your JSON.",
    "You may mention additional possible issues, but you must not treat your applicableSections array as the source of truth.",
  ].join("\n");
}

function normalizeComparable(value: string): { statute: Statute; code: string } {
  const upper = value.toUpperCase().replace(/\([^)]*\)/g, " ");
  let statute: Statute = "UNKNOWN";
  if (/\bBNSS\b/.test(upper)) statute = "BNSS";
  else if (/\bBNS\b/.test(upper)) statute = "BNS";
  else if (/\bCRPC\b/.test(upper) || /\bCR\.?\s*P\.?\s*C\.?\b/.test(upper)) statute = "CRPC";
  else if (/\bIPC\b/.test(upper)) statute = "IPC";
  const codeMatch = upper.match(CODE_IN_TEXT_RE);
  return { statute, code: codeMatch ? codeMatch[1] : "" };
}

function isProceduralProvision(value: string): boolean {
  const { statute, code } = normalizeComparable(value);
  if (!code) return false;
  if (statute === "IPC" || statute === "BNS") return false;
  return PROCEDURAL_CRPC.has(code) || statute === "CRPC" || statute === "BNSS";
}

function unresolvedProceduralEntry(framework: LegalFramework, bailType: string): ApplicableSectionEntry {
  return {
    code: "Unresolved procedural provision",
    title: "Procedural provision unresolved",
    relevance: `Framework is ${framework}; ${bailType.toLowerCase().includes("anticipatory") ? "anticipatory" : "regular"}-bail provision was not selected automatically`,
    source: "unresolved",
  };
}

export function proceduralProvisionsForBailType(
  bailType: string,
  framework: LegalFramework,
  bailCourtLevel: BailCourtLevel = "UNSPECIFIED",
): ApplicableSectionEntry[] {
  const isAnticipatory = bailType.toLowerCase().includes("anticipatory") || bailType.toLowerCase().includes("438") || bailType.toLowerCase().includes("482");
  if (framework === "UNSPECIFIED" || framework === "MIXED_LEGACY") return [unresolvedProceduralEntry(framework, bailType)];

  if (isAnticipatory) {
    return [{
      code: framework === "CURRENT_BNS_BNSS" ? "BNSS 482" : "CrPC 438",
      title: "Anticipatory bail",
      relevance: "Procedural provision — derived from the declared bail type, not an offence section",
      source: "procedural",
    }];
  }

  if (framework === "CURRENT_BNS_BNSS") {
    if (bailCourtLevel === "MAGISTRATE") {
      return [{
        code: "BNSS 480",
        title: "Magistrate bail in non-bailable offences",
        relevance: "Procedural provision — derived from the declared bail type and court level, not an offence section",
        source: "procedural",
      }];
    }
    if (bailCourtLevel === "SESSIONS" || bailCourtLevel === "HIGH_COURT") {
      return [{
        code: "BNSS 483",
        title: "Sessions Court / High Court bail",
        relevance: "Procedural provision — derived from the declared bail type and court level, not an offence section",
        source: "procedural",
      }];
    }
    return [unresolvedProceduralEntry(framework, bailType)];
  }

  if (bailCourtLevel === "MAGISTRATE") {
    return [{
      code: "CrPC 437",
      title: "Magistrate bail in non-bailable offences",
      relevance: "Procedural provision — derived from the declared bail type and court level, not an offence section",
      source: "procedural",
    }];
  }

  if (bailCourtLevel === "SESSIONS" || bailCourtLevel === "HIGH_COURT") {
    return [{
      code: "CrPC 439",
      title: "Sessions Court / High Court bail",
      relevance: "Procedural provision — derived from the declared bail type and court level, not an offence section",
      source: "procedural",
    }];
  }

  return [
    {
      code: "CrPC 437",
      title: "Magistrate bail in non-bailable offences",
      relevance: "Procedural provision — derived from the declared bail type, not an offence section",
      source: "procedural",
    },
    {
      code: "CrPC 439",
      title: "Sessions Court / High Court bail",
      relevance: "Procedural provision — derived from the declared bail type, not an offence section",
      source: "procedural",
    },
  ];
}

function suppliedRelevance(section: ParsedSection): string {
  if (section.frameworkConflict) return `User-supplied ${section.display} conflicts with the selected framework; declaration preserved and not rewritten`;
  if (section.statute === "UNKNOWN") return "User-supplied section with unspecified statute; not validated by deterministic legal rules";
  if (hasDeterministicSectionRule({ statute: section.statute, section: section.code, subsection: section.subsection })) return "User-supplied statutory section; recognized by deterministic legal rules";
  if (section.statute === "BNS" || section.statute === "BNSS") return `User-supplied ${section.statute} section (declared; not validated by the deterministic IPC/special-act rule engine)`;
  if (section.statute === "CRPC") return "User-supplied procedural provision";
  return "User-supplied statutory section; no matching deterministic rule (preserved as declared)";
}

export function mergeApplicableSections(options: {
  parsed: ParsedSection[];
  bailType: string;
  framework: LegalFramework;
  bailCourtLevel?: BailCourtLevel;
  llmSections: unknown[];
}): ApplicableSectionEntry[] {
  const framework = options.framework;
  const suppliedKeys = new Set(options.parsed.map((section) => `${section.statute}:${section.code}`));
  const suppliedEntries = options.parsed.map((section) => ({ code: section.display, title: section.display, relevance: suppliedRelevance(section), source: "supplied" as const }));
  const hasExplicitProceduralStatute = options.parsed.some((section) => section.statute === "CRPC" || section.statute === "BNSS");
  const procedural = proceduralProvisionsForBailType(options.bailType, framework, options.bailCourtLevel).filter((entry) => {
    if (framework === "MIXED_LEGACY" && hasExplicitProceduralStatute && entry.source === "unresolved") return false;
    const comparable = normalizeComparable(entry.code);
    return !suppliedKeys.has(`${comparable.statute}:${comparable.code}`);
  });

  const inferred: ApplicableSectionEntry[] = [];
  const inferredKeys = new Set<string>();
  for (const raw of options.llmSections) {
    const code = typeof raw === "string" ? raw.trim() : String((raw as { code?: string; title?: string })?.code || (raw as { title?: string })?.title || "").trim();
    const title = typeof raw === "string" ? raw.trim() : String((raw as { title?: string; code?: string })?.title || (raw as { code?: string })?.code || "").trim();
    const relevance = typeof raw === "string" ? "" : String((raw as { relevance?: string; description?: string })?.relevance || (raw as { description?: string })?.description || "").trim();
    if (!code && !title) continue;
    const comparable = normalizeComparable(code || title);
    if (!comparable.code || comparable.statute === "UNKNOWN" || isProceduralProvision(code || title)) continue;
    const key = `${comparable.statute}:${comparable.code}`;
    if (suppliedKeys.has(key) || inferredKeys.has(key)) continue;
    inferredKeys.add(key);
    inferred.push({ code: comparable.statute === "CRPC" ? `CrPC ${comparable.code}` : `${comparable.statute} ${comparable.code}`, title: title || code, relevance: relevance || "Possible/unverified issue (AI-inferred; not user-supplied)", source: "inferred" });
  }

  return [...suppliedEntries, ...procedural, ...inferred];
}
