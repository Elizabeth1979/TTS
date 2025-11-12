import { renderHook } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioPlayer } from "./useAudioPlayer";

function createMockAudioElement() {
  return {
    load: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    src: "",
    currentTime: 0,
  } as unknown as HTMLAudioElement;
}

describe("useAudioPlayer", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    warnSpy.mockClear();
  });

  afterEach(() => {
    warnSpy.mockClear();
  });

  afterAll(() => {
    warnSpy.mockRestore();
  });

  it("plays a provided source", async () => {
    const element = createMockAudioElement();
    const { result } = renderHook(() => useAudioPlayer());

    result.current.audioRef.current = element;
    const status = await result.current.play("blob:123");

    expect(element.src).toBe("blob:123");
    expect(element.load).toHaveBeenCalledTimes(1);
    expect(element.play).toHaveBeenCalledTimes(1);
    expect(status).toBe("played");
  });

  it("returns blocked when autoplay fails", async () => {
    const element = createMockAudioElement();
    element.play = vi.fn().mockRejectedValue(new DOMException("Blocked", "NotAllowedError"));
    const { result } = renderHook(() => useAudioPlayer());

    result.current.audioRef.current = element;
    const status = await result.current.play("blob:321");

    expect(status).toBe("blocked");
    expect(console.warn).toHaveBeenCalled();
  });

  it("replays the current source from beginning", async () => {
    const element = createMockAudioElement();
    const { result } = renderHook(() => useAudioPlayer());

    result.current.audioRef.current = element;
    element.src = "blob:999";
    element.currentTime = 5;

    const status = await result.current.replay();

    expect(element.currentTime).toBe(0);
    expect(element.play).toHaveBeenCalledTimes(1);
    expect(status).toBe("played");
  });
});
