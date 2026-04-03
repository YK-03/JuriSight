import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateBailAnalysisFromInput } from "@/lib/ai";

const GuestAnalyzeSchema = z.object({
  section: z.string().min(1),
  offenseType: z.string().min(1),
  accusedProfile: z.string().min(1),
  priorRecord: z.string().min(1),
  cooperationLevel: z.string().min(1),
  offenseDescription: z.string().min(1),
});

const rateLimitMap = new Map<string, number[]>();
const ONE_HOUR_MS = 60 * 60 * 1000;
const LIMIT = 3;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter((ts) => now - ts < ONE_HOUR_MS);

  if (recent.length >= LIMIT) {
    rateLimitMap.set(ip, recent);
    return true;
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please sign up for unlimited access." },
        { status: 429 },
      );
    }

    const body = GuestAnalyzeSchema.parse(await request.json());

    const analysis = await generateBailAnalysisFromInput({
      section: body.section,
      offenseType: body.offenseType,
      accusedProfile: body.accusedProfile,
      priorRecord: body.priorRecord,
      offenseDescription: body.offenseDescription,
      cooperationLevel: body.cooperationLevel,
      jurisdiction: "",
    });

    return NextResponse.json(analysis);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
