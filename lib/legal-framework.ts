export type LegalFramework =
  | "LEGACY_IPC_CRPC"
  | "CURRENT_BNS_BNSS"
  | "MIXED_LEGACY"
  | "UNSPECIFIED";

export const LEGAL_FRAMEWORKS = [
  "LEGACY_IPC_CRPC",
  "CURRENT_BNS_BNSS",
  "MIXED_LEGACY",
  "UNSPECIFIED",
] as const satisfies readonly LegalFramework[];

export function isLegalFramework(value: unknown): value is LegalFramework {
  return typeof value === "string" && (LEGAL_FRAMEWORKS as readonly string[]).includes(value);
}

/** Normalize only canonical values. Old bail-type strings are not framework metadata. */
export function normalizeLegalFramework(value: unknown): LegalFramework {
  return isLegalFramework(value) ? value : "UNSPECIFIED";
}

export function inferLegalFrameworkFromSections(raw: string | undefined | null): LegalFramework {
  const value = typeof raw === "string" ? raw : "";
  const hasLegacy = /\b(?:IPC|CR\.?PC)\b/i.test(value);
  const hasCurrent = /\b(?:BNS|BNSS)\b/i.test(value);

  if (hasLegacy && hasCurrent) return "MIXED_LEGACY";
  if (hasLegacy) return "LEGACY_IPC_CRPC";
  if (hasCurrent) return "CURRENT_BNS_BNSS";
  return "UNSPECIFIED";
}

export function resolveLegalFramework(options: {
  explicit?: unknown;
  persisted?: unknown;
  suppliedSections?: string | null;
}): LegalFramework {
  if (isLegalFramework(options.explicit)) return options.explicit;
  if (isLegalFramework(options.persisted)) return options.persisted;
  return inferLegalFrameworkFromSections(options.suppliedSections);
}

export function defaultBailProvisionForFramework(framework: LegalFramework): string | null {
  switch (framework) {
    case "LEGACY_IPC_CRPC":
      return "CrPC 167(2)";
    case "CURRENT_BNS_BNSS":
      return "BNSS 187";
    case "UNSPECIFIED":
    default:
      return null;
  }
}
