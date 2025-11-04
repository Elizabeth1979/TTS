import { z } from "zod";
import { LANGUAGE_OPTIONS, type LanguageCode } from "./languages";

export const synthesizeSchema = z.object({
  text: z
    .string()
    .min(1, "Text is required")
    .max(5_000, "Text must be shorter than 5,000 characters"),
  voiceId: z.string().min(1, "Voice is required"),
  language: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }
      return value as LanguageCode;
    })
    .refine(
      (value) =>
        !value ||
        value === "auto" ||
        LANGUAGE_OPTIONS.some((option) => option.code === value),
      "Unsupported language selected"
    ),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  styleExaggeration: z.number().min(0).max(1).optional(),
  optimizeStreamingLatency: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  modelId: z.string().optional()
});

export type SynthesizePayload = z.infer<typeof synthesizeSchema>;
