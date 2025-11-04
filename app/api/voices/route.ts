import { NextResponse } from "next/server";
import { fetchVoices } from "@/lib/elevenlabs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const voices = await fetchVoices();
    return NextResponse.json({ voices });
  } catch (error) {
    console.error(error);

    // Provide more detailed error message
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const userFriendlyMessage = errorMessage.includes("missing_permissions")
      ? "Your ElevenLabs API key is missing required permissions. Please generate a new API key with 'voices_read' permission enabled."
      : errorMessage.includes("401")
      ? "Invalid or unauthorized ElevenLabs API key. Please check your API key."
      : "Unable to load ElevenLabs voices. Check your API key and network connection.";

    return NextResponse.json(
      {
        error: userFriendlyMessage,
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
