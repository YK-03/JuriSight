// lib/surety-engine.ts

export type OffenseType = "non-bailable" | "bailable" | "ndps" | "uapa" | "pmla" | "unknown";
export type CustodyDuration = "under-30" | "1-6mo" | "6-12mo" | "1-2yr" | "over-2yr";
export type PreviousBail = "none" | "1-rejected" | "2plus-rejected" | "granted-cancelled";

export interface CaseData {
  offenseType: OffenseType | string;
  sections: string;
  custodyDuration: CustodyDuration | string;
  previousBail: PreviousBail | string;
  accusedTags: string[];
}

export interface SuretyRangeResult {
  min: number;
  max: number;
  label: string;
  reasoning: string[];
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
}

export function getSuretyRange(caseData: CaseData): SuretyRangeResult {
  let min = 10000;
  let max = 50000;
  const reasoning: string[] = [];
  let baseSet = false;

  const sectionsLower = (caseData.sections || "").toLowerCase();
  const offenseType = caseData.offenseType || "unknown";

  // 1. Special Acts
  if (!baseSet && (offenseType === "uapa" || offenseType === "pmla" || sectionsLower.includes("uapa") || sectionsLower.includes("pmla"))) {
    min = 100000;
    max = 500000;
    reasoning.push("Base: Special Acts (UAPA/PMLA)");
    baseSet = true;
  }

  // 2. NDPS
  if (!baseSet && offenseType === "ndps") {
    // Detect commercial vs intermediate using 21(c) or 22(c)
    if (sectionsLower.includes("21(c)") || sectionsLower.includes("22(c)")) {
      min = 50000;
      max = 200000;
      reasoning.push("Base: NDPS Commercial Quantity");
    } else {
      min = 20000;
      max = 100000;
      reasoning.push("Base: NDPS Intermediate Quantity (default)");
    }
    baseSet = true;
  }

  // 3. Violent offences
  if (!baseSet && (sectionsLower.includes("307") || sectionsLower.includes("302"))) {
    min = 50000;
    max = 200000;
    reasoning.push("Base: Serious Violent Offence");
    baseSet = true;
  } else if (!baseSet && (sectionsLower.includes("323") || sectionsLower.includes("506"))) {
    min = 10000;
    max = 40000;
    reasoning.push("Base: Moderate Violent Offence");
    baseSet = true;
  }

  // 4. Economic offences
  if (!baseSet && (sectionsLower.includes("420") || sectionsLower.includes("467") || sectionsLower.includes("406") || sectionsLower.includes("120b"))) {
    min = 30000;
    max = 150000;
    reasoning.push("Base: Economic Offence");
    baseSet = true;
  }

  // 5. Property offences
  if (!baseSet && (sectionsLower.includes("379") || sectionsLower.includes("411"))) {
    min = 10000;
    max = 50000;
    reasoning.push("Base: Property Offence");
    baseSet = true;
  }

  // 6. Default
  if (!baseSet) {
    min = 10000;
    max = 50000;
    reasoning.push("Base: Default Offence Range");
  }

  // --- Modifier Layer ---
  
  // Modifiers: Increase
  if (caseData.previousBail === "1-rejected" || caseData.previousBail === "2plus-rejected") {
    min *= 1.2;
    max *= 1.3;
    reasoning.push("Modifier: Previous Bail Rejected (+)");
  }

  if (caseData.custodyDuration === "6-12mo" || caseData.custodyDuration === "1-2yr" || caseData.custodyDuration === "over-2yr") {
    min *= 1.1;
    max *= 1.1;
    reasoning.push("Modifier: Custody > 6 Months (+)");
  }

  // Modifiers: Decrease
  if (caseData.accusedTags.includes("medical condition")) {
    min *= 0.8;
    max *= 0.8;
    reasoning.push("Modifier: Medical Condition (-)");
  }

  if (caseData.accusedTags.includes("senior citizen")) {
    min *= 0.8;
    max *= 0.8;
    reasoning.push("Modifier: Senior Citizen (-)");
  }

  if (caseData.accusedTags.includes("parity with co-accused")) {
    min *= 0.85;
    max *= 0.85;
    reasoning.push("Modifier: Parity (-)");
  }

  if (caseData.accusedTags.includes("clean antecedents")) {
    min *= 0.9;
    max *= 0.9;
    reasoning.push("Modifier: Clean Antecedents (-)");
  }

  // Round and constraint
  min = Math.round(min / 1000) * 1000;
  max = Math.round(max / 1000) * 1000;

  min = Math.max(10000, min);
  // Ensure max is at least min + 10,000, but clamp to 500,000
  max = Math.max(min + 10000, max);
  max = Math.min(500000, max);

  const label = `${formatCurrency(min)} – ${formatCurrency(max)}`;

  return {
    min,
    max,
    label,
    reasoning
  };
}
