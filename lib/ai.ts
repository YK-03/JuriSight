import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import type { Case } from "@prisma/client";
import { z } from "zod";

const BailAnalysisSchema = z.object({
  eligibilityStatus: z.enum(["LIKELY_ELIGIBLE", "LIKELY_INELIGIBLE", "BORDERLINE"]),
  confidenceLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
  confidenceExplanation: z.string(),
  riskScore: z.number().int().min(1).max(10),
  riskFactors: z.object({
    flightRisk: z.enum(["LOW", "MEDIUM", "HIGH"]),
    offenseSeverity: z.enum(["LOW", "MODERATE", "HIGH", "SEVERE"]),
    evidenceTampering: z.enum(["LOW", "MEDIUM", "HIGH"]),
    communityTies: z.enum(["WEAK", "MODERATE", "STRONG"]),
  }),
  legalBasis: z.object({
    classification: z.enum(["BAILABLE", "NON_BAILABLE"]),
    applicableSections: z.array(z.string()),
    primarySection: z.string(),
  }),
  reasoning: z.string(),
  positiveFactors: z.array(z.string()),
  negativeFactors: z.array(z.string()),
  suggestedConditions: z.array(z.string()),
  recommendation: z.string(),
  biasWarning: z.string().nullable(),
});

export type BailAnalysisOutput = z.infer<typeof BailAnalysisSchema>;

type BailAnalysisInput = {
  section: string;
  offenseType: string;
  accusedProfile: string;
  priorRecord: string | boolean;
  offenseDescription: string;
  cooperationLevel: string;
  jurisdiction: string;
};

function extractJsonBlock(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}

export async function generateBailAnalysis(caseData: Case): Promise<BailAnalysisOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing");
  }

  return generateBailAnalysisFromInput({
    section: caseData.section,
    offenseType: caseData.offenseType,
    accusedProfile: caseData.accusedProfile,
    priorRecord: caseData.priorRecord,
    offenseDescription: caseData.offenseDescription,
    cooperationLevel: caseData.cooperationLevel,
    jurisdiction: caseData.jurisdiction,
  });
}

export async function generateBailAnalysisFromInput(input: BailAnalysisInput): Promise<BailAnalysisOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing");
  }

  const system =
    "You are JuriSight, an expert Indian criminal law AI specializing in bail analysis under CrPC, Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023, IPC, Bharatiya Nyaya Sanhita (BNS) 2023, and special criminal laws including SC/ST Act, POCSO, cybercrime statutes, and economic offense laws. You provide structured, explainable bail eligibility assessments for use as judicial decision support. Your outputs assist but do not replace judicial discretion. Be transparent, auditable, and precise. Respond ONLY with valid JSON. No markdown, no explanation outside JSON.";

  const userPrompt = `Analyze this case for bail eligibility. Return JSON with EXACTLY these fields:
{
  eligibilityStatus: 'LIKELY_ELIGIBLE' | 'LIKELY_INELIGIBLE' | 'BORDERLINE',
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW',
  confidenceExplanation: string,
  riskScore: number (1-10, where 1=lowest risk, 10=highest),
  riskFactors: {
    flightRisk: 'LOW' | 'MEDIUM' | 'HIGH',
    evidenceTampering: 'LOW' | 'MEDIUM' | 'HIGH',
    communityTies: 'WEAK' | 'MODERATE' | 'STRONG',
    offenseSeverity: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE'
  },
  legalBasis: {
    classification: 'BAILABLE' | 'NON_BAILABLE',
    applicableSections: string[],
    primarySection: string
  },
  reasoning: string,
  positiveFactors: string[],
  negativeFactors: string[],
  suggestedConditions: string[],
  recommendation: string,
  biasWarning: string | null
}

Calculate riskScore as:
- Start at 5 (neutral)
- +2 if prior record exists
- +2 if offense severity HIGH or SEVERE
- +1 if flight risk HIGH, -1 if LOW
- +1 if evidence tampering HIGH
- -1 if community ties STRONG, +1 if WEAK
- -1 if cooperation FULLY_COOPERATIVE, +1 if NON_COOPERATIVE
- Clamp final score between 1 and 10

biasWarning: if case data is insufficient, set a warning string like
'Limited case data may affect assessment accuracy'. Otherwise null.

positiveFactors and negativeFactors: 
Extract 2-4 bullet points each from the reasoning.
Each string should be a clear, short sentence (max 12 words).

suggestedConditions:
Provide 2-5 realistic bail conditions appropriate to this case.
Only include if eligibilityStatus is LIKELY_ELIGIBLE or BORDERLINE.

Case Data:
Section: ${input.section}
Offense Type: ${input.offenseType}
Accused Profile: ${input.accusedProfile}
Prior Record: ${typeof input.priorRecord === "boolean" ? (input.priorRecord ? "Yes" : "No") : input.priorRecord}
Offense Description: ${input.offenseDescription}
Cooperation Level: ${input.cooperationLevel}
Jurisdiction: ${input.jurisdiction}`;

  const { text } = await generateText({
    model: anthropic("claude-opus-4-5"),
    system,
    prompt: userPrompt,
  });

  const parsed = extractJsonBlock(text);
  return BailAnalysisSchema.parse(parsed);
}
