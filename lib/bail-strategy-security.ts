import type { BailStrategyInput } from "./bail-strategy-engine";

export function detectMaterialContradictions(
  body: BailStrategyInput,
  parsedAge: number | null,
  chargesheetFiled: boolean,
): string[] {
  const context = body.additionalContext.toLowerCase();
  const contradictions: string[] = [];
  const add = (message: string) => {
    if (!contradictions.includes(message)) contradictions.push(message);
  };

  if (body.previousBail === "none" && !/no\s+(?:prior|previous)\s+bail\s+rejection/i.test(context)
    && /(?:prior|previous)\s+bail\s+(?:was\s+)?(?:rejected|denied)|bail\s+(?:was\s+)?(?:rejected|denied)/i.test(context)) {
    add("Structured previous bail status says none, but the narrative describes a prior bail rejection.");
  }

  const saysFiled = /\b(?:charge[- ]?sheet|chargesheet)\s+(?:was\s+)?(?:filed|submitted)\b/i.test(context);
  const saysNotFiled = /\b(?:charge[- ]?sheet|chargesheet)\s+(?:(?:was|has)\s+)?(?:not\s+(?:been\s+)?(?:filed|submitted)|pending)\b|\bno[- ]?chargesheet\b/i.test(context);
  if (chargesheetFiled && saysNotFiled) add("Structured chargesheet status says filed, but the narrative says it was not filed.");
  if (!chargesheetFiled && saysFiled) add("Structured chargesheet status says not filed, but the narrative says it was filed.");

  const custodyRanges = [
    { name: "under-30", pattern: /under\s*-?\s*30\s*days?|less than\s*30\s*days?/i, min: 0, max: 29 },
    { name: "1-6mo", pattern: /1\s*(?:-|to)\s*6\s*months?/i, min: 30, max: 183 },
    { name: "6-12mo", pattern: /6\s*(?:-|to)\s*12\s*months?/i, min: 184, max: 365 },
    { name: "1-2yr", pattern: /1\s*(?:-|to)\s*2\s*years?/i, min: 366, max: 730 },
    { name: "over-2yr", pattern: /over\s*2\s*years?|more than\s*2\s*years?/i, min: 731, max: Number.POSITIVE_INFINITY },
  ];
  const mentionedRange = custodyRanges.find((range) => range.pattern.test(context));
  if (mentionedRange && mentionedRange.name !== body.custodyDuration) {
    add(`Structured custody range is ${body.custodyDuration}, but the narrative describes ${mentionedRange.name}.`);
  }
  const explicitDays = context.match(/\b(\d+)\s+days?\b/i);
  if (explicitDays) {
    const days = Number(explicitDays[1]);
    const selectedRange = custodyRanges.find((range) => range.name === body.custodyDuration);
    if (selectedRange && (days < selectedRange.min || days > selectedRange.max)) {
      add(`Structured custody range is ${body.custodyDuration}, but the narrative states ${days} days.`);
    }
  }

  const narrativeAge = context.match(/\b(?:age|aged)\s*(?:is|:)?\s*(\d{1,3})\b/i);
  if (narrativeAge && parsedAge !== null && Number(narrativeAge[1]) !== parsedAge) {
    add(`Structured age is ${parsedAge}, but the narrative states age ${narrativeAge[1]}.`);
  }

  const structuredSections = body.sections.toLowerCase().split(/[,\n]+/).map((section) => section.trim()).filter(Boolean);
  const narrativeSections = [...context.matchAll(/\b(?:ipc|bns|ndps|pmla|uapa|crpc|bnss)\s*(?:act\s*)?(?:section\s*)?\d+[a-z]*(?:\([^)]+\))?/gi)]
    .map((match) => match[0].replace(/\s+/g, " ").trim());
  for (const narrativeSection of narrativeSections) {
    const normalizedNarrative = narrativeSection.replace(/\bact\b|\bsection\b/gi, "").replace(/\s+/g, " ").trim();
    if (!structuredSections.some((section) => section.replace(/\bact\b|\bsection\b/gi, "").replace(/\s+/g, " ").trim().toLowerCase() === normalizedNarrative.toLowerCase())) {
      add(`Structured sections do not include the narrative's reference to ${narrativeSection}.`);
    }
  }

  if (body.offenseType === "ndps" && body.ndpsQuantity &&
    ((body.ndpsQuantity === "commercial" && /\bsmall quantity\b/i.test(context)) ||
      (body.ndpsQuantity === "small" && /\bcommercial quantity\b/i.test(context)))) {
    add(`Structured NDPS quantity is ${body.ndpsQuantity}, but the narrative states a different quantity category.`);
  }

  return contradictions;
}
