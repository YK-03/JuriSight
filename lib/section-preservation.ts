import { hasDeterministicSectionRule } from "./legal-rules";

export type StatutePrefix = "IPC" | "BNS" | "CRPC";

export type ParsedSection = {
  statute: StatutePrefix;
  code: string;
  display: string;
};

export type ApplicableSectionEntry = {
  code: string;
  title: string;
  relevance: string;
  source: "supplied" | "procedural" | "deterministic" | "inferred";
};

const CODE_RE = /^(\d+[A-Za-z]*)$/;
const CODE_IN_TEXT_RE = /(\d+[A-Za-z]*)/;
const PROCEDURAL_CRPC = new Set(["437", "438", "439", "167", "167A", "41A"]);

export function parseSuppliedSections(raw: string): {
  forRules: string[];
  suppliedRaw: string[];
  parsed: ParsedSection[];
} {
  if (!raw || !raw.trim() || /^not specified/i.test(raw.trim())) {
    return { forRules: [], suppliedRaw: [], parsed: [] };
  }

  const cleaned = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\band\b/gi, ",")
    .replace(/\bu\/s\b/gi, " ");

  const delimitedTokens = cleaned.split(/[,;\/\n]+/);
  let currentPrefix: StatutePrefix = "IPC";
  const parsed: ParsedSection[] = [];
  const seen = new Set<string>();

  for (const rawToken of delimitedTokens) {
    const token = rawToken.trim();
    if (!token) continue;

    const prefixMatch = token.match(/^(IPC|BNS|CRPC|CrPC)\s+(?:Sections?\s+)?(.*)$/i);
    let remainder = token;

    if (prefixMatch) {
      const marker = prefixMatch[1].toUpperCase();
      currentPrefix = marker === "CRPC" ? "CRPC" : (marker as StatutePrefix);
      remainder = (prefixMatch[2] || "").trim();
    } else {
      remainder = token.replace(/^sections?\s+/i, "").trim();
    }

    const codeMatch = remainder.match(CODE_IN_TEXT_RE);
    if (!codeMatch) continue;

    const code = codeMatch[1].toUpperCase();
    if (!CODE_RE.test(code)) continue;

    const key = `${currentPrefix}:${code}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const display =
      currentPrefix === "CRPC" ? `CrPC ${code}` : `${currentPrefix} ${code}`;

    parsed.push({
      statute: currentPrefix,
      code,
      display,
    });
  }

  const forRules = parsed
    .filter((section) => section.statute === "IPC")
    .map((section) => section.code);

  return {
    forRules,
    suppliedRaw: parsed.map((section) => section.display),
    parsed,
  };
}

export function formatAuthoritativeSectionsBlock(suppliedRaw: string[]): string {
  if (suppliedRaw.length === 0) {
    return "AUTHORITATIVE SUPPLIED SECTIONS: none declared by the user.";
  }

  return [
    "AUTHORITATIVE SUPPLIED SECTIONS (DO NOT DROP, REPLACE, OR SHRINK THIS LIST):",
    suppliedRaw.join(", "),
    "These sections were declared on intake. The backend preserves them independently of your JSON.",
    "You may mention additional possible issues, but you must not treat your applicableSections array as the source of truth.",
  ].join("\n");
}

function normalizeComparable(value: string): { statute: StatutePrefix | "UNKNOWN"; code: string } {
  const upper = value.toUpperCase().replace(/\([^)]*\)/g, " ");
  let statute: StatutePrefix | "UNKNOWN" = "UNKNOWN";
  if (/\bBNS\b/.test(upper)) statute = "BNS";
  else if (/\bCRPC\b/.test(upper) || /\bCR\.?\s*P\.?\s*C\.?\b/.test(upper)) statute = "CRPC";
  else if (/\bIPC\b/.test(upper)) statute = "IPC";

  const codeMatch = upper.match(CODE_IN_TEXT_RE);
  return { statute, code: codeMatch ? codeMatch[1] : "" };
}

function isProceduralProvision(value: string): boolean {
  const { statute, code } = normalizeComparable(value);
  if (!code) return false;
  if (statute === "IPC" || statute === "BNS") return false;
  return PROCEDURAL_CRPC.has(code) || statute === "CRPC";
}

export function proceduralProvisionsForBailType(
  bailType: string,
): ApplicableSectionEntry[] {
  const isAnticipatory =
    bailType.toLowerCase().includes("anticipatory") || bailType.toLowerCase().includes("438");

  if (isAnticipatory) {
    return [
      {
        code: "CrPC 438",
        title: "Anticipatory bail",
        relevance: "Procedural provision — derived from the declared bail type, not an offence section",
        source: "procedural",
      },
    ];
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
  if (section.statute === "BNS") {
    return "User-supplied BNS section (declared; not validated by the deterministic IPC/special-act rule engine)";
  }
  if (section.statute === "CRPC") {
    return "User-supplied procedural provision";
  }
  if (hasDeterministicSectionRule(section.code)) {
    return "User-supplied statutory section; recognized by deterministic legal rules";
  }
  return "User-supplied statutory section; no matching deterministic rule (preserved as declared)";
}

export function mergeApplicableSections(options: {
  parsed: ParsedSection[];
  bailType: string;
  llmSections: unknown[];
}): ApplicableSectionEntry[] {
  const suppliedKeys = new Set(options.parsed.map((section) => `${section.statute}:${section.code}`));

  const suppliedEntries: ApplicableSectionEntry[] = options.parsed.map((section) => ({
    code: section.display,
    title: section.display,
    relevance: suppliedRelevance(section),
    source: "supplied",
  }));

  const procedural = proceduralProvisionsForBailType(options.bailType).filter((entry) => {
    const comparable = normalizeComparable(entry.code);
    return !suppliedKeys.has(`${comparable.statute}:${comparable.code}`);
  });

  const inferred: ApplicableSectionEntry[] = [];
  const inferredKeys = new Set<string>();

  for (const raw of options.llmSections) {
    const code =
      typeof raw === "string"
        ? raw.trim()
        : String((raw as { code?: string; title?: string })?.code || (raw as { title?: string })?.title || "").trim();
    const title =
      typeof raw === "string"
        ? raw.trim()
        : String((raw as { title?: string; code?: string })?.title || (raw as { code?: string })?.code || "").trim();
    const relevance =
      typeof raw === "string"
        ? ""
        : String((raw as { relevance?: string; description?: string })?.relevance || (raw as { description?: string })?.description || "").trim();

    if (!code && !title) continue;

    const comparable = normalizeComparable(code || title);
    if (!comparable.code) continue;
    if (isProceduralProvision(code || title)) continue;

    const statute = comparable.statute === "UNKNOWN" ? "IPC" : comparable.statute;
    const key = `${statute}:${comparable.code}`;
    if (suppliedKeys.has(key) || inferredKeys.has(key)) continue;
    inferredKeys.add(key);

    inferred.push({
      code: statute === "CRPC" ? `CrPC ${comparable.code}` : `${statute} ${comparable.code}`,
      title: title || code,
      relevance: relevance || "Possible/unverified issue (AI-inferred; not user-supplied)",
      source: "inferred",
    });
  }

  return [...suppliedEntries, ...procedural, ...inferred];
}
