import { NextRequest, NextResponse } from "next/server";
import { synthesizeSchema } from "@/lib/schemas";
import { synthesizeSpeechStream } from "@/lib/elevenlabs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let json: unknown;

  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = synthesizeSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
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
      modelId: payload.modelId
    });

    return new NextResponse(audioStream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked"
      }
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to synthesize speech";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
