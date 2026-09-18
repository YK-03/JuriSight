export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH";

export type RiskFactorContract = {
  title: string;
  description: string;
  severity: RiskSeverity;
};

export type AnalysisRiskFactor = {
  title: string;
  label: string;
  description: string;
  severity: "High" | "Medium" | "Low";
};

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "onto",
  "over",
  "under",
  "may",
  "might",
  "could",
  "would",
  "should",
  "court",
  "bail",
  "case",
  "risk",
  "factor",
  "possible",
  "potential",
  "therefore",
  "because",
  "about",
  "their",
  "there",
  "which",
  "while",
  "where",
  "when",
  "been",
  "being",
  "have",
  "has",
  "had",
  "will",
  "not",
  "any",
  "are",
  "was",
  "were",
  "its",
]);

const GENERIC_DESCRIPTION =
  /\b(the court may|could lead to|may prompt|higher bail|strict bail conditions|seriousness of the offence)\b/i;

export function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[₹]/g, "rs ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isNearDuplicateText(left: string, right: string): boolean {
  const a = normalizeComparableText(left);
  const b = normalizeComparableText(right);
  if (!a || !b) return true;
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;

  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (aTokens.size === 0 || bTokens.size === 0) return true;
  return jaccard(aTokens, bTokens) >= 0.72;
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeComparableText(value)
      .split(" ")
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function extraContentWordCount(title: string, description: string): number {
  const titleNorm = normalizeComparableText(title);
  const descriptionNorm = normalizeComparableText(description);
  const remainder = descriptionNorm.replace(titleNorm, " ").replace(/\s+/g, " ").trim();
  return remainder.split(" ").filter((word) => word.length > 2 && !STOPWORDS.has(word)).length;
}

function hasMeaningfulExplanation(title: string, description: string): boolean {
  if (description.trim().length < 48) return false;
  if (description.trim().split(/\s+/).length < 12) return false;
  if (isNearDuplicateText(title, description)) return false;
  return extraContentWordCount(title, description) >= 6;
}

export function normalizeRiskSeverity(value: unknown): RiskSeverity {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "HIGH" || raw === "SEVERE") return "HIGH";
  if (raw === "LOW" || raw === "WEAK" || raw === "MINOR") return "LOW";
  return "MEDIUM";
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function conciseTitle(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim().replace(/[.]+$/, "");
  const clause = cleaned
    .split(/\b(?:may|might|could|would|should)\b/i)[0]
    .trim()
    .replace(/[,:;.-]+$/, "");
  const source = clause || cleaned;
  const words = source.split(/\s+/);
  if (words.length > 10) return words.slice(0, 8).join(" ");
  return source;
}

function clusterKey(title: string): string {
  const t = title.toLowerCase();
  if (/tamper|witness|interfer|evidence/.test(t)) return "interference";
  if (/flight|abscond|flee/.test(t)) return "flight";
  if (/economic|loss|amount|lakh|crore|₹|rs\b/.test(t)) return "economic";
  if (/forger|cheat|conspir|serious|section|offence|offense/.test(t)) return "offence-gravity";
  if (/custody|incarcer|remand/.test(t)) return "custody";
  if (/prior|previous|record|antecedent|convict/.test(t)) return "antecedents";
  return normalizeComparableText(title) || "other";
}

function isGroundedInCase(description: string, caseFacts?: string): boolean {
  if (!caseFacts || !caseFacts.trim()) return true;
  const factTokens = tokenize(caseFacts);
  const descriptionTokens = tokenize(description);
  const overlap = [...descriptionTokens].filter((token) => factTokens.has(token));
  if (overlap.length >= 2) return true;

  const distinctive = [...descriptionTokens].filter((token) =>
    /\d/.test(token) || /lakh|crore|forged|witness|468|420|471|120b/.test(token),
  );
  return distinctive.some((token) => factTokens.has(token) || caseFacts.toLowerCase().includes(token));
}

function isGenericBoilerplate(description: string, caseFacts?: string): boolean {
  if (!GENERIC_DESCRIPTION.test(description)) return false;
  if (!caseFacts) return description.trim().split(/\s+/).length < 18;
  return !isGroundedInCase(description, caseFacts);
}

function parseRawItem(raw: unknown): { title: string; description: string; severity: RiskSeverity } | null {
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return null;
    return { title: conciseTitle(text), description: text, severity: "MEDIUM" };
  }

  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const title = pickString(item.title, item.label, item.factor, item.name);
  const description = pickString(item.description, item.detail, item.explanation, item.why, item.text);
  const single = pickString(item.text, item.label, item.title);

  if (title && description) {
    return {
      title: conciseTitle(title),
      description,
      severity: normalizeRiskSeverity(item.severity || item.level),
    };
  }

  if (single) {
    return {
      title: conciseTitle(title || single),
      description: description || single,
      severity: normalizeRiskSeverity(item.severity || item.level),
    };
  }

  return null;
}

export function normalizeRiskFactors(
  raw: unknown,
  options: { caseFacts?: string } = {},
): RiskFactorContract[] {
  const rawList = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.values(raw)
      : [];

  const accepted: RiskFactorContract[] = [];
  const seenClusters = new Set<string>();

  for (const rawItem of rawList) {
    const parsed = parseRawItem(rawItem);
    if (!parsed) continue;

    const title = conciseTitle(parsed.title);
    const description = parsed.description.replace(/\s+/g, " ").trim();
    if (!title || !description) continue;
    if (!hasMeaningfulExplanation(title, description)) continue;
    if (isGenericBoilerplate(description, options.caseFacts)) continue;
    if (!isGroundedInCase(description, options.caseFacts)) continue;

    const cluster = clusterKey(title);
    if (seenClusters.has(cluster)) continue;
    seenClusters.add(cluster);

    if (accepted.some((existing) => isNearDuplicateText(existing.title, title))) continue;

    accepted.push({
      title,
      description,
      severity: parsed.severity,
    });
  }

  return accepted.slice(0, 5);
}

export function toAnalysisRiskFactors(factors: RiskFactorContract[]): AnalysisRiskFactor[] {
  return factors.map((factor) => ({
    title: factor.title,
    label: factor.title,
    description: factor.description,
    severity:
      factor.severity === "HIGH" ? "High" : factor.severity === "LOW" ? "Low" : "Medium",
  }));
}
