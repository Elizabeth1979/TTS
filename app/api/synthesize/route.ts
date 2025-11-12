import { NextRequest, NextResponse } from "next/server";
import type { ZodError } from "zod";
import { synthesizeSchema } from "@/lib/schemas";
import { synthesizeSpeechStream } from "@/lib/elevenlabs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let json: unknown;

  try {
    json = await request.json();
  } catch (error) {
    console.error("[api/synthesize] Invalid JSON payload", error);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = synthesizeSchema.safeParse(json);

  if (!parsed.success) {
    const message = getValidationMessage(parsed.error);
    console.warn("[api/synthesize] Validation error:", message);
    return NextResponse.json({ error: `Invalid input: ${message}` }, { status: 422 });
  }

  const payload = parsed.data;

  try {
    const audioStream = await synthesizeSpeechStream({
      text: payload.text,
      voiceId: payload.voiceId,
      languageCode: payload.language,
      stability: payload.stability,
      similarityBoost: payload.similarityBoost,
      styleExaggeration: payload.styleExaggeration,
      optimizeStreamingLatency: payload.optimizeStreamingLatency,
      modelId: payload.modelId,
    });

    return new NextResponse(audioStream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("[api/synthesize] Upstream synthesis failed", error);
    return NextResponse.json(
      { error: "Synthesis service failed. Please try again." },
      { status: 502 }
    );
  }
}

function getValidationMessage(error: ZodError): string {
  const flattened = error.flatten();
  const fieldErrorEntries = Object.values(flattened.fieldErrors ?? {}).flat();
  const primaryFieldError = fieldErrorEntries.find((msg): msg is string => typeof msg === "string");
  if (primaryFieldError) {
    return primaryFieldError;
  }

  const formError = flattened.formErrors.find((msg): msg is string => typeof msg === "string");
  return formError ?? "Please review the submitted values.";
}
