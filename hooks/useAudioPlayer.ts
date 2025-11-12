"use client";

import { useCallback, useRef } from "react";

export type PlayResult = "played" | "blocked" | "idle";

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const setSourceAndPlay = useCallback(async (src: string) => {
    const element = audioRef.current;
    if (!element) {
      return "idle";
    }

    if (element.src !== src) {
      element.src = src;
    }

    try {
      element.load();
    } catch {
      // Some browsers load automatically; ignore load errors.
    }

    return playElement(element);
  }, []);

  const replay = useCallback(async () => {
    const element = audioRef.current;
    if (!element || !element.src) {
      return "idle";
    }

    try {
      element.currentTime = 0;
    } catch {
      // Ignore failures to reset time
    }

    return playElement(element);
  }, []);

  const pause = useCallback(() => {
    const element = audioRef.current;
    if (!element) {
      return;
    }
    element.pause();
  }, []);

  return {
    audioRef,
    play: setSourceAndPlay,
    replay,
    pause,
  };
}

async function playElement(element: HTMLMediaElement): Promise<PlayResult> {
  try {
    await element.play();
    return "played";
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "NotAllowedError" || error.name === "AbortError")
    ) {
      console.warn("[audio] Autoplay blocked by browser policy.");
      return "blocked";
    }

    console.warn("[audio] Failed to play audio element.", error);
    return "blocked";
  }
}
