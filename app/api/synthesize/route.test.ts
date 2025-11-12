import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { synthesizeSpeechStream } from "@/lib/elevenlabs";

vi.mock("@/lib/elevenlabs", () => ({
  synthesizeSpeechStream: vi.fn(),
}));

const mockSynthesize = vi.mocked(synthesizeSpeechStream);

function createRequest(body: BodyInit) {
  return new NextRequest(
    new Request("http://localhost/api/synthesize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );
}

describe("POST /api/synthesize", () => {
  beforeEach(() => {
    mockSynthesize.mockReset();
  });

  it("returns 400 when JSON body is invalid", async () => {
    const request = createRequest("{ not-valid json }");
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid JSON payload" });
    expect(mockSynthesize).not.toHaveBeenCalled();
  });

  it("returns 422 when validation fails", async () => {
    const request = createRequest(
      JSON.stringify({
        text: "",
        voiceId: "",
      }),
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/Invalid input/i);
    expect(mockSynthesize).not.toHaveBeenCalled();
  });

  it("returns 502 when upstream synthesis fails", async () => {
    mockSynthesize.mockRejectedValue(new Error("Upstream error"));

    const request = createRequest(
      JSON.stringify({
        text: "Hello world",
        voiceId: "voice-1",
        language: "en",
        stability: 0.5,
        similarityBoost: 0.7,
        optimizeStreamingLatency: 1,
      }),
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: "Synthesis service failed. Please try again.",
    });
    expect(mockSynthesize).toHaveBeenCalled();
  });
});


