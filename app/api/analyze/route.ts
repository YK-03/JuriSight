import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalyzeRequest, CaseAnalysis } from "@/lib/analysis-types";

export const runtime = "nodejs";

const systemPrompt = `You are JuriSight, an expert Indian legal analysis AI with deep knowledge of IPC, CrPC, BNS 2023, constitutional law, and Supreme Court / High Court precedents.

Analyse the case description provided and respond ONLY with a valid JSON object — no markdown, no explanation, no preamble. The JSON must exactly match this TypeScript interface:

{
  "verdict": "Favorable" | "Unfavorable" | "Mixed",
  "riskScore": number,          // 0 = no risk, 100 = extreme risk
  "summary": string,            // 2-3 sentences, plain English
  "riskFactors": [
    {
      "label": string,
      "severity": "High" | "Medium" | "Low",
      "description": string       // 1 sentence
    }
  ],
  "legalReasoning": string,     // 3-5 paragraphs, cite specific sections
  "applicableSections": [
    {
      "code": string,             // e.g. "IPC 420", "BNS 316"
      "title": string,
      "relevance": string         // 1 sentence
    }
  ],
  "precedents": [
    {
      "case": string,
      "citation": string,         // year + court abbreviation
      "relevance": string         // 1 sentence
    }
  ],
  "recommendations": string[],  // 3-5 actionable items
  "biasWarning": string | null  // flag if caste/religion/gender bias risk
}

Return only the JSON object. Nothing before or after it.`;



export async function POST(req: Request) {
  try {
    const body: AnalyzeRequest = await req.json();
    const caseDescription = body.caseDescription;

    if (!caseDescription || caseDescription.trim().length < 20) {
      return NextResponse.json({ error: "Case description must be at least 20 characters long." }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API key not configured." }, { status: 500 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is missing in environment" }),
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const result = await model.generateContent(caseDescription);
    const responseText = result.response.text();

    let cleanJsonText = responseText.trim();
    if (cleanJsonText.startsWith("\`\`\`json")) {
      cleanJsonText = cleanJsonText.replace(/^\`\`\`json\s*/i, "");
    }
    if (cleanJsonText.startsWith("\`\`\`")) {
      cleanJsonText = cleanJsonText.replace(/^\`\`\`\s*/, "");
    }
    if (cleanJsonText.endsWith("\`\`\`")) {
      cleanJsonText = cleanJsonText.replace(/\s*\`\`\`$/, "");
    }

    let analysis: CaseAnalysis;

    try {
      analysis = JSON.parse(cleanJsonText);
    } catch (parseError) {
      console.error("JSON Parse Error:", cleanJsonText);

      return NextResponse.json(
        { error: "Model returned invalid JSON format." },
        { status: 500 }
      );
    }

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error("Analysis Error:", error);
    return NextResponse.json({ error: error.message || "Failed to analyze case description." }, { status: 500 });
  }
}
