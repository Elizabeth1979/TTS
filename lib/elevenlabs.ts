import { getServerEnv } from "./env";
import { resolveLanguageCode, type LanguageCode } from "./languages";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

export interface ElevenLabsVoice {
  id: string;
  name: string;
  description?: string;
  languageCode?: LanguageCode;
  language?: string;
  accent?: string;
  category?: string;
  previewUrl?: string;
}

interface ElevenLabsVoiceResponse {
  voice_id: string;
  name: string;
  description?: string;
  preview_url?: string;
  category?: string;
  labels?: Record<string, string>;
}

export interface SynthesisInput {
  text: string;
  voiceId: string;
  languageCode?: LanguageCode;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  styleExaggeration?: number;
  useSpeakerBoost?: boolean;
  optimizeStreamingLatency?: 0 | 1 | 2;
  outputFormat?: "mp3_44100_128" | "mp3_44100_64" | "mp3_22050_32" | "pcm_16000";
}

export async function fetchVoices(): Promise<ElevenLabsVoice[]> {
  const env = getServerEnv();
  console.info("[elevenlabs] Fetching voices…");
  console.info("[elevenlabs] Using API key ending in:", env.ELEVENLABS_API_KEY.slice(-4));
  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "xi-api-key": env.ELEVENLABS_API_KEY
    },
    cache: "no-store"
  });

  if (!response.ok) {
    console.error(
      "[elevenlabs] Voice fetch failed",
      response.status,
      response.statusText
    );
    const errorBody = await safeParseJson(response);
    throw new Error(
      `Failed to fetch voices (${response.status} ${response.statusText}): ${
        (errorBody && JSON.stringify(errorBody)) || "unknown error"
      }`
    );
  }

  const payload = (await response.json()) as { voices: ElevenLabsVoiceResponse[] };
  console.info("[elevenlabs] Received voices", payload.voices.length);

  return payload.voices.map((voice) => {
    const languageLabel =
      voice.labels?.language ??
      voice.labels?.accent ??
      voice.labels?.lang ??
      voice.labels?.Locale ??
      voice.labels?.Language;

    return {
      id: voice.voice_id,
      name: voice.name,
      description: voice.description,
      accent: voice.labels?.accent,
      category: voice.category,
      previewUrl: voice.preview_url,
      language: languageLabel,
      languageCode: resolveLanguageCode(languageLabel)
    };
  });
}

export async function synthesizeSpeech(input: SynthesisInput): Promise<Buffer> {
  const env = getServerEnv();
  const {
    text,
    voiceId,
    languageCode,
    modelId = env.ELEVENLABS_MODEL_ID,
    stability = 0.5,
    similarityBoost = 0.8,
    styleExaggeration,
    useSpeakerBoost = true,
    optimizeStreamingLatency = env.ELEVENLABS_OPTIMIZE_LATENCY ?? 0,
    outputFormat = "mp3_44100_128"
  } = input;

  console.info("[elevenlabs] Synthesizing speech", {
    voiceId,
    languageCode,
    modelId,
    textLength: text.length
  });

  // eleven_v3 requires specific stability values: 0.0, 0.5, or 1.0
  const normalizeStabilityForV3 = (value: number): number => {
    if (value <= 0.25) return 0.0;
    if (value <= 0.75) return 0.5;
    return 1.0;
  };

  const stabilityValue = modelId === "eleven_v3"
    ? normalizeStabilityForV3(stability)
    : clamp(stability, 0, 1);

  const response = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      language_code: languageCode === "auto" ? undefined : languageCode,
      voice_settings: {
        stability: stabilityValue,
        similarity_boost: clamp(similarityBoost, 0, 1),
        style: styleExaggeration !== undefined ? clamp(styleExaggeration, 0, 1) : undefined,
        use_speaker_boost: useSpeakerBoost
      },
      optimize_streaming_latency: optimizeStreamingLatency,
      output_format: outputFormat
    })
  });

  if (!response.ok) {
    console.error(
      "[elevenlabs] Synthesis failed",
      response.status,
      response.statusText
    );
    const errorBody = await safeParseJson(response);
    throw new Error(
      `Failed to synthesize speech (${response.status} ${response.statusText}): ${
        (errorBody && JSON.stringify(errorBody)) || "unknown error"
      }`
    );
  }

  const audio = await response.arrayBuffer();
  console.info("[elevenlabs] Synthesis succeeded", {
    bytes: audio.byteLength
  });
  return Buffer.from(audio);
}

export async function synthesizeSpeechStream(input: SynthesisInput): Promise<ReadableStream<Uint8Array>> {
  const env = getServerEnv();
  const {
    text,
    voiceId,
    languageCode,
    modelId = env.ELEVENLABS_MODEL_ID,
    stability = 0.5,
    similarityBoost = 0.8,
    styleExaggeration,
    useSpeakerBoost = true,
    optimizeStreamingLatency = env.ELEVENLABS_OPTIMIZE_LATENCY ?? 0,
    outputFormat = "mp3_44100_128"
  } = input;

  console.info("[elevenlabs] Synthesizing speech (streaming)", {
    voiceId,
    languageCode,
    modelId,
    textLength: text.length
  });

  // eleven_v3 requires specific stability values: 0.0, 0.5, or 1.0
  const normalizeStabilityForV3 = (value: number): number => {
    if (value <= 0.25) return 0.0;
    if (value <= 0.75) return 0.5;
    return 1.0;
  };

  const stabilityValue = modelId === "eleven_v3"
    ? normalizeStabilityForV3(stability)
    : clamp(stability, 0, 1);

  const response = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}/stream`, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
      "xi-api-key": env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      language_code: languageCode === "auto" ? undefined : languageCode,
      voice_settings: {
        stability: stabilityValue,
        similarity_boost: clamp(similarityBoost, 0, 1),
        style: styleExaggeration !== undefined ? clamp(styleExaggeration, 0, 1) : undefined,
        use_speaker_boost: useSpeakerBoost
      },
      optimize_streaming_latency: optimizeStreamingLatency,
      output_format: outputFormat
    })
  });

  if (!response.ok) {
    console.error(
      "[elevenlabs] Streaming synthesis failed",
      response.status,
      response.statusText
    );
    const errorBody = await safeParseJson(response);
    throw new Error(
      `Failed to synthesize speech (${response.status} ${response.statusText}): ${
        (errorBody && JSON.stringify(errorBody)) || "unknown error"
      }`
    );
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  console.info("[elevenlabs] Streaming synthesis started");
  return response.body;
}

async function safeParseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
