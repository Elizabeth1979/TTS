import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { fetchVoices } from "@/lib/elevenlabs";

vi.mock("@/lib/elevenlabs", () => ({
  fetchVoices: vi.fn(),
}));

const mockFetchVoices = vi.mocked(fetchVoices);

describe("GET /api/voices", () => {
  it("returns voices when ElevenLabs responds successfully", async () => {
    mockFetchVoices.mockResolvedValue([
      { id: "1", name: "Voice 1" },
      { id: "2", name: "Voice 2" },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      voices: [
        { id: "1", name: "Voice 1" },
        { id: "2", name: "Voice 2" },
      ],
    });
  });

  it("returns a friendly error message when ElevenLabs request fails", async () => {
    mockFetchVoices.mockRejectedValue(new Error("401 Unauthorized"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Invalid or unauthorized ElevenLabs API key. Check your key.",
    });
  });
});


