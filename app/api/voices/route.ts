import { NextResponse } from "next/server";
import { fetchVoices } from "@/lib/elevenlabs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const voices = await fetchVoices();
    return NextResponse.json({ voices });
  } catch (error) {
    console.error("[api/voices] Failed to fetch voices", error);

    const details = error instanceof Error ? error.message : "Unknown error";
    const userFriendlyMessage = details.includes("missing_permissions")
      ? "Your ElevenLabs API key is missing required permissions. Generate a key with voices_read access."
      : details.includes("401")
      ? "Invalid or unauthorized ElevenLabs API key. Check your key."
      : "Unable to load ElevenLabs voices. Verify your API key and network connection.";

    return NextResponse.json({ error: userFriendlyMessage }, { status: 500 });
  }
}
