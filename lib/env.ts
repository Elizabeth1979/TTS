import { z } from "zod";

const envSchema = z.object({
  ELEVENLABS_API_KEY: z.string().min(1, "ELEVENLABS_API_KEY is required"),
  ELEVENLABS_MODEL_ID: z.string().min(1).default("eleven_multilingual_v2"),
  ELEVENLABS_OPTIMIZE_LATENCY: z
    .preprocess((val) => {
      if (typeof val === "string" && val.length) {
        const parsed = Number.parseInt(val, 10);
        return Number.isNaN(parsed) ? undefined : parsed;
      }
      return val;
    }, z.number().min(0).max(2))
    .optional()
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getServerEnv() {
  // In development, always reload env vars to pick up changes
  if (process.env.NODE_ENV === "development") {
    cachedEnv = null;
  }

  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse({
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    ELEVENLABS_MODEL_ID: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
    ELEVENLABS_OPTIMIZE_LATENCY: process.env.ELEVENLABS_OPTIMIZE_LATENCY
  });

  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}
