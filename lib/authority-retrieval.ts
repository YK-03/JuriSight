import type { LegalRuleOutput } from "./legal-rules";
import type { AuthoritativeEligibilityResult, BailStrategyInput } from "./bail-strategy-engine";

export type AuthorityProfile = "CASE_ANALYSIS" | "BAIL_ELIGIBILITY";
export type AuthorityProvenance = "curated" | "verified" | "retrieved" | "unverified";

export const MAX_BAIL_AUTHORITY_QUERY_VARIANTS = 3;
export const MAX_BAIL_AUTHORITY_SEARCH_REQUESTS_PER_SCENARIO = MAX_BAIL_AUTHORITY_QUERY_VARIANTS;
export const MAX_BAIL_AUTHORITY_CASE_DETAIL_REQUESTS_PER_SCENARIO = MAX_BAIL_AUTHORITY_QUERY_VARIANTS;
export const MAX_BAIL_AUTHORITY_CANDIDATES_PER_QUERY = 1;

/** Interpretation derived locally or by a contextual model; never provider verification metadata. */
export type DerivedAuthorityInterpretation = {
  legalPrinciple?: string;
  matchedIssues?: string[];
};

export type RetrievedAuthority = {
  authorityId: string;
  caseName: string;
  court?: string;
  authorityLevel?: "binding" | "persuasive" | "unknown";
  date?: string;
  citation?: string;
  judgmentUrl?: string;
  source?: string;
  relevantSections?: string[];
  relevantPassage?: string;
  derived?: DerivedAuthorityInterpretation;
  provenance: AuthorityProvenance;
};

/** Source metadata required before an authority may be marked verified. */
export type VerifiedAuthorityCandidate = {
  authorityId: string;
  caseName: string;
  court: string;
  citation?: string;
  officialIdentifier?: string;
  date: string;
  source: string;
  judgmentUrl: string;
  relevantPassage: string;
  authorityLevel?: "binding" | "persuasive" | "unknown";
  relevantSections?: string[];
};

export type VerifiedAuthority = Omit<VerifiedAuthorityCandidate, "citation" | "officialIdentifier"> & {
  citation?: string;
  officialIdentifier?: string;
  provenance: "verified";
};

export type VerifiedAuthorityValidation =
  | { ok: true; authority: VerifiedAuthority }
  | { ok: false; errors: string[] };

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates provider output without repairing or guessing missing provenance.
 * This checks required metadata shape; it does not independently verify the source.
 */
export function validateVerifiedAuthority(input: unknown): VerifiedAuthorityValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["Authority record must be an object"] };
  }

  const candidate = input as Partial<VerifiedAuthorityCandidate>;
  const errors: string[] = [];
  if (!nonEmptyString(candidate.authorityId)) errors.push("authorityId is required");
  if (!nonEmptyString(candidate.caseName)) errors.push("caseName is required");
  if (!nonEmptyString(candidate.court)) errors.push("court is required");
  if (!nonEmptyString(candidate.date)) errors.push("date is required");
  if (!nonEmptyString(candidate.source)) errors.push("source is required");
  if (!nonEmptyString(candidate.relevantPassage)) errors.push("relevantPassage is required");

  const identifier = nonEmptyString(candidate.citation)
    ? candidate.citation
    : nonEmptyString(candidate.officialIdentifier)
    ? candidate.officialIdentifier
    : "";
  if (!identifier) errors.push("citation or officialIdentifier is required");

  if (!nonEmptyString(candidate.judgmentUrl)) {
    errors.push("judgmentUrl is required");
  } else {
    try {
      const url = new URL(candidate.judgmentUrl);
      if (url.protocol !== "https:") errors.push("judgmentUrl must use https");
    } catch {
      errors.push("judgmentUrl must be a valid URL");
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    authority: {
      authorityId: candidate.authorityId!.trim(),
      caseName: candidate.caseName!.trim(),
      court: candidate.court!.trim(),
      ...(candidate.citation?.trim() ? { citation: candidate.citation.trim() } : {}),
      ...(candidate.officialIdentifier?.trim() ? { officialIdentifier: candidate.officialIdentifier.trim() } : {}),
      date: candidate.date!.trim(),
      source: candidate.source!.trim(),
      judgmentUrl: candidate.judgmentUrl!.trim(),
      relevantPassage: candidate.relevantPassage!.trim(),
      ...(candidate.authorityLevel ? { authorityLevel: candidate.authorityLevel } : {}),
      ...(candidate.relevantSections ? { relevantSections: candidate.relevantSections } : {}),
      provenance: "verified",
    },
  };
}

export type AuthorityRetrievalQuery = {
  profile: AuthorityProfile;
  legalFramework?: string;
  sections: string[];
  offenseType?: string;
  bailType?: string;
  proceduralStage?: string;
  custodyDays?: number;
  chargesheetFiled?: boolean;
  previousBail?: string;
  accusedTags?: string[];
  authority?: string;
  issues: string[];
  queryText: string;
};

export interface AuthorityRetriever {
  retrieve(query: AuthorityRetrievalQuery): Promise<RetrievedAuthority[]>;
}

/**
 * Real-source boundary. Providers may supply source metadata only; public web
 * access does not establish permission for automated or bulk ingestion, and
 * provider-specific API, licensing, storage, and redistribution rights remain
 * separate operational requirements.
 */
export interface VerifiedAuthoritySource {
  retrieve(query: AuthorityRetrievalQuery): Promise<unknown[]>;
}

export async function retrieveVerifiedAuthorities(
  source: VerifiedAuthoritySource,
  query: AuthorityRetrievalQuery,
  onRejected?: (errors: string[], candidate: unknown) => void,
  onError?: (error: unknown) => void,
): Promise<VerifiedAuthority[]> {
  try {
    const candidates = await source.retrieve(query);
    const verified: VerifiedAuthority[] = [];
    for (const candidate of candidates) {
      const result = validateVerifiedAuthority(candidate);
      if (!result.ok) {
        onRejected?.("errors" in result ? result.errors : ["Invalid verified authority"], candidate);
        continue;
      }
      verified.push(result.authority);
    }
    return verified;
  } catch (error) {
    onError?.(error);
    return [];
  }
}

export type ProgressiveVerifiedRetrievalResult = {
  verifiedAuthorities: VerifiedAuthority[];
  attemptedQueries: AuthorityRetrievalQuery[];
};

/** Runs bounded query variants and stops after the first verified result. */
export async function retrieveVerifiedAuthoritiesProgressively(
  source: VerifiedAuthoritySource,
  queries: readonly AuthorityRetrievalQuery[],
  onRejected?: (errors: string[], candidate: unknown) => void,
  onError?: (error: unknown) => void,
): Promise<ProgressiveVerifiedRetrievalResult> {
  const attemptedQueries: AuthorityRetrievalQuery[] = [];

  for (const query of queries.slice(0, MAX_BAIL_AUTHORITY_QUERY_VARIANTS)) {
    attemptedQueries.push(query);
    const verifiedAuthorities = await retrieveVerifiedAuthorities(source, query, onRejected, onError);
    if (verifiedAuthorities.length > 0) {
      return { verifiedAuthorities, attemptedQueries };
    }
  }

  return { verifiedAuthorities: [], attemptedQueries };
}

export async function retrieveAuthoritiesSafely(
  retriever: AuthorityRetriever,
  query: AuthorityRetrievalQuery,
  onError?: (error: unknown) => void,
): Promise<RetrievedAuthority[]> {
  try {
    return await retriever.retrieve(query);
  } catch (error) {
    onError?.(error);
    return [];
  }
}

/** Uses verified source metadata when available; curated records are fallback only. */
export function selectVerifiedOrCuratedAuthorities(
  verified: VerifiedAuthority[],
  curated: RetrievedAuthority[],
): RetrievedAuthority[] {
  return verified.length > 0 ? verified : curated;
}

type BailAuthorityQueryOptions = {
  input: BailStrategyInput;
  legalRules: LegalRuleOutput;
  authoritativeResult: AuthoritativeEligibilityResult;
  custodyDays: number;
  chargesheetFiled: boolean;
};

const addIssue = (issues: string[], value: string | undefined) => {
  const clean = value?.trim();
  if (clean && !issues.includes(clean)) issues.push(clean);
};

/** Builds a compact legal-issue query without sending the full case narrative. */
export function buildBailAuthorityQuery({
  input,
  legalRules,
  authoritativeResult,
  custodyDays,
  chargesheetFiled,
}: BailAuthorityQueryOptions): AuthorityRetrievalQuery {
  const profile: AuthorityProfile = "BAIL_ELIGIBILITY";
  const sections = input.sections.split(/[,\n]+/).map((section) => section.trim()).filter(Boolean);
  const issues: string[] = [];

  addIssue(issues, input.legalFramework);
  sections.forEach((section) => addIssue(issues, section));
  addIssue(issues, input.offenseType === "non-bailable" ? "non-bailable offence" : input.offenseType);
  addIssue(issues, labelForCourtStageIssue(input.courtStage));
  addIssue(issues, chargesheetFiled ? "chargesheet filed" : "investigation ongoing");
  addIssue(issues, `custody ${custodyDays} days`);
  addIssue(issues, input.previousBail === "none" ? "no prior bail rejection" : "previous bail history");

  if (legalRules.defaultBail.eligible === true) addIssue(issues, "default bail");
  if (legalRules.defaultBail.eligible === false) addIssue(issues, "default bail not available");
  if (legalRules.ndpsBar?.twinConditionsRequired) addIssue(issues, "NDPS Section 37 twin conditions");
  if (legalRules.pmlaConditions?.twinConditionsRequired) addIssue(issues, "PMLA twin conditions");
  if (input.offenseType === "uapa") addIssue(issues, "UAPA statutory restriction");
  if (authoritativeResult.authority === "DISCRETIONARY") addIssue(issues, "judicial discretion");

  const tags = input.accusedTags.map((tag) => tag.trim().toLowerCase());
  if (tags.some((tag) => tag.includes("cooperat"))) addIssue(issues, "cooperation");
  if (tags.some((tag) => tag.includes("parity"))) addIssue(issues, "parity");
  if (tags.some((tag) => tag.includes("first-time") || tag.includes("clean antecedent") || tag.includes("no prior"))) {
    addIssue(issues, "first-time offender");
  }

  const context = input.additionalContext.toLowerCase();
  if (/delay|delayed trial|pending trial|trial will take/.test(context)) addIssue(issues, "trial delay");
  if (/economic|financial|fraud|cheating|money laundering/.test(context)) addIssue(issues, "economic offence");
  if (/arrest|detention|remand|custody/.test(context)) addIssue(issues, "arrest and detention");

  const queryText = issues.join(" ");
  return {
    profile,
    legalFramework: input.legalFramework,
    sections,
    offenseType: input.offenseType,
    proceduralStage: input.courtStage,
    custodyDays,
    chargesheetFiled,
    previousBail: input.previousBail,
    accusedTags: input.accusedTags,
    authority: "bail authority",
    issues,
    queryText,
  };
}

function uniqueIssues(values: string[]): string[] {
  return values.filter((value, index) => value.length > 0 && values.indexOf(value) === index);
}

export type BailAuthorityQueryTermClassification = {
  coreLegalIdentifiers: string[];
  legalIssues: string[];
  proceduralContext: string[];
  factualFactors: string[];
};

export function classifyBailAuthorityQueryTerms(
  baseQuery: AuthorityRetrievalQuery,
): BailAuthorityQueryTermClassification {
  const coreLegalIdentifiers = uniqueIssues([
    ...baseQuery.sections,
    ...baseQuery.issues.filter((issue) => /non-bailable|bailable|ndps|uapa|pmla|unknown/i.test(issue)),
    ...baseQuery.issues.filter((issue) => /NDPS Section 37|PMLA twin conditions|UAPA statutory restriction/i.test(issue)),
  ]);
  const legalIssues = baseQuery.issues.filter((issue) =>
    /default bail|Section 37|Section 45|statutory restriction|judicial discretion/i.test(issue),
  );
  const proceduralContext = baseQuery.issues.filter((issue) =>
    /Court|chargesheet|pre-chargesheet|investigation ongoing|custody|prior bail/i.test(issue),
  );
  const factualFactors = baseQuery.issues.filter((issue) =>
    /cooperation|parity|first-time offender|trial delay|economic offence|arrest and detention/i.test(issue),
  );

  return {
    coreLegalIdentifiers,
    legalIssues: uniqueIssues(legalIssues),
    proceduralContext: uniqueIssues(proceduralContext),
    factualFactors: uniqueIssues(factualFactors),
  };
}

function withIssues(query: AuthorityRetrievalQuery, issues: string[]): AuthorityRetrievalQuery {
  const normalized = uniqueIssues(issues.map((issue) => issue.trim()).filter(Boolean));
  return {
    ...query,
    issues: normalized,
    queryText: normalized.join(" "),
  };
}

/**
 * Builds a small ordered query set. Core statute/section identifiers are kept
 * in every variant while procedural and factual modifiers are intentionally
 * omitted from external search text.
 */
export function buildProgressiveBailAuthorityQueries(
  baseQuery: AuthorityRetrievalQuery,
): AuthorityRetrievalQuery[] {
  const classified = classifyBailAuthorityQueryTerms(baseQuery);
  const core = classified.coreLegalIdentifiers;
  const primaryIssue = classified.legalIssues[0] || "bail";
  const secondaryIssue = classified.legalIssues.find((issue) => issue !== primaryIssue) || "bail";
  const sectionOrCore = core.length > 0 ? core : [baseQuery.offenseType || "bail"];

  const variants = [
    withIssues(baseQuery, [...sectionOrCore, primaryIssue]),
    withIssues(baseQuery, [...sectionOrCore, secondaryIssue]),
    withIssues(baseQuery, [...sectionOrCore, "bail"]),
  ];

  return variants.filter((variant, index) =>
    variants.findIndex((candidate) => candidate.queryText === variant.queryText) === index,
  ).slice(0, MAX_BAIL_AUTHORITY_QUERY_VARIANTS);
}

function firstMatchingIssue(issues: readonly string[], patterns: readonly RegExp[]): string | undefined {
  return patterns.flatMap((pattern) => issues.filter((issue) => pattern.test(issue)))[0];
}

/**
 * Builds the optimized deterministic query set used by the Bail Strategy
 * provider path. Statute/framework and sections are retained in every query;
 * procedural and factual modifiers remain internal and are not emitted.
 */
export function buildOptimizedProgressiveBailAuthorityQueries(
  baseQuery: AuthorityRetrievalQuery,
): AuthorityRetrievalQuery[] {
  const classified = classifyBailAuthorityQueryTerms(baseQuery);
  const core = uniqueIssues([
    baseQuery.legalFramework || "",
    ...baseQuery.sections,
  ]);
  const legalIssues = uniqueIssues([
    ...baseQuery.issues,
    ...classified.legalIssues,
  ]);
  const issueCandidates = legalIssues.filter((issue) =>
    !classified.proceduralContext.includes(issue)
      && !classified.factualFactors.includes(issue)
      && !baseQuery.sections.includes(issue)
      && issue !== baseQuery.legalFramework,
  );
  const primaryIssue = firstMatchingIssue(issueCandidates, [
    /^default bail$/i,
    /NDPS Section 37/i,
    /PMLA twin conditions/i,
    /UAPA statutory restriction/i,
    /juvenile bail/i,
    /^non-bailable offence$/i,
    /^bailable$/i,
    /^judicial discretion$/i,
    /^unknown$/i,
    /^ndps$/i,
  ]) || "bail";
  const specializedIssue = firstMatchingIssue(issueCandidates, [
    /^default bail$/i,
    /NDPS Section 37/i,
    /PMLA twin conditions/i,
    /UAPA statutory restriction/i,
    /juvenile bail/i,
    /statutory restriction/i,
  ]);
  const secondaryIssue = specializedIssue && specializedIssue !== primaryIssue
    ? specializedIssue
    : issueCandidates.find((issue) => issue !== primaryIssue && !core.some((value) => value === issue));
  const identifiers = core.length > 0 ? core : [baseQuery.offenseType || "bail"];

  const variants = [
    withIssues(baseQuery, [...identifiers, primaryIssue]),
    withIssues(baseQuery, [...identifiers, secondaryIssue || "bail"]),
    withIssues(baseQuery, [...identifiers, "bail"]),
  ];

  return variants.filter((variant, index) =>
    variants.findIndex((candidate) => candidate.queryText === variant.queryText) === index,
  ).slice(0, MAX_BAIL_AUTHORITY_QUERY_VARIANTS);
}

function labelForCourtStageIssue(stage: BailStrategyInput["courtStage"]): string {
  switch (stage) {
    case "MAGISTRATE": return "Magistrate Court";
    case "SESSIONS": return "Sessions Court";
    case "HIGH_COURT": return "High Court";
    case "no-chargesheet": return "pre-chargesheet";
    case "UNSPECIFIED": return "court level unspecified";
  }
}
