import { describe, expect, it } from "vitest";
import { getErrorMessage, readJsonSafe } from "./http";

describe("readJsonSafe", () => {
  it("returns parsed JSON when response body is valid", async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });

    const payload = await readJsonSafe<{ ok: boolean }>(response);
    expect(payload).toEqual({ ok: true });
  });

  it("returns undefined when response body is not valid JSON", async () => {
    const response = new Response("not json", {
      headers: { "Content-Type": "application/json" },
    });

    const payload = await readJsonSafe(response);
    expect(payload).toBeUndefined();
  });
});

describe("getErrorMessage", () => {
  it("prefers error string from payload", () => {
    const response = new Response(null, { status: 400, statusText: "Bad Request" });
    const message = getErrorMessage(response, { error: "Invalid API key" });
    expect(message).toBe("Invalid API key");
  });

  it("falls back to response status text", () => {
    const response = new Response(null, { status: 404, statusText: "Not Found" });
    const message = getErrorMessage(response, {});
    expect(message).toBe("Not Found");
  });

  it("falls back to default message when nothing else available", () => {
    const message = getErrorMessage(undefined, undefined);
    expect(message).toBe("Request failed");
  });
});
