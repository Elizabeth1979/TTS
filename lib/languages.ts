export type LanguageCode =
  | "auto"
  | "ar"
  | "cs"
  | "da"
  | "de"
  | "en"
  | "es"
  | "fi"
  | "fr"
  | "he"
  | "hi"
  | "hu"
  | "it"
  | "ja"
  | "ko"
  | "nl"
  | "pl"
  | "pt"
  | "ru"
  | "sv"
  | "tr"
  | "uk"
  | "zh";

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  sample?: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "auto", label: "Auto detect" },
  { code: "he", label: "Hebrew", sample: "שלום עולם" },
  { code: "en", label: "English", sample: "Hello world" },
  { code: "es", label: "Spanish", sample: "Hola mundo" },
  { code: "fr", label: "French", sample: "Bonjour le monde" },
  { code: "de", label: "German", sample: "Hallo Welt" },
  { code: "it", label: "Italian", sample: "Ciao mondo" },
  { code: "pt", label: "Portuguese", sample: "Olá mundo" },
  { code: "ru", label: "Russian", sample: "Привет мир" },
  { code: "ja", label: "Japanese", sample: "こんにちは世界" },
  { code: "ko", label: "Korean", sample: "안녕하세요 세계" },
  { code: "zh", label: "Chinese", sample: "你好世界" },
  { code: "ar", label: "Arabic", sample: "مرحبا بالعالم" },
  { code: "hi", label: "Hindi", sample: "नमस्ते दुनिया" },
  { code: "cs", label: "Czech", sample: "Ahoj světe" },
  { code: "da", label: "Danish", sample: "Hej verden" },
  { code: "fi", label: "Finnish", sample: "Hei maailma" },
  { code: "hu", label: "Hungarian", sample: "Helló világ" },
  { code: "nl", label: "Dutch", sample: "Hallo wereld" },
  { code: "pl", label: "Polish", sample: "Witaj świecie" },
  { code: "sv", label: "Swedish", sample: "Hej världen" },
  { code: "tr", label: "Turkish", sample: "Merhaba dünya" },
  { code: "uk", label: "Ukrainian", sample: "Привіт світ" }
];

const NAME_TO_CODE = new Map<string, LanguageCode>(
  [
    ["auto", "auto"],
    ["he", "he"],
    ["hebrew", "he"],
    ["hebrew (modern)", "he"],
    ["en", "en"],
    ["english", "en"],
    ["american english", "en"],
    ["british english", "en"],
    ["es", "es"],
    ["spanish", "es"],
    ["castilian spanish", "es"],
    ["latin american spanish", "es"],
    ["fr", "fr"],
    ["french", "fr"],
    ["de", "de"],
    ["german", "de"],
    ["it", "it"],
    ["italian", "it"],
    ["pt", "pt"],
    ["portuguese", "pt"],
    ["br portuguese", "pt"],
    ["ru", "ru"],
    ["russian", "ru"],
    ["ja", "ja"],
    ["japanese", "ja"],
    ["ko", "ko"],
    ["korean", "ko"],
    ["zh", "zh"],
    ["chinese", "zh"],
    ["mandarin chinese", "zh"],
    ["ar", "ar"],
    ["arabic", "ar"],
    ["hi", "hi"],
    ["hindi", "hi"],
    ["cs", "cs"],
    ["czech", "cs"],
    ["da", "da"],
    ["danish", "da"],
    ["fi", "fi"],
    ["finnish", "fi"],
    ["hu", "hu"],
    ["hungarian", "hu"],
    ["nl", "nl"],
    ["dutch", "nl"],
    ["pl", "pl"],
    ["polish", "pl"],
    ["sv", "sv"],
    ["swedish", "sv"],
    ["tr", "tr"],
    ["turkish", "tr"],
    ["uk", "uk"],
    ["ukrainian", "uk"]
  ] as const
);

export function resolveLanguageCode(input?: string | null): LanguageCode | undefined {
  if (!input) {
    return undefined;
  }
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  const direct = NAME_TO_CODE.get(normalized);
  if (direct) {
    return direct;
  }

  // Attempt to parse two letter ISO code from combined strings (e.g. "en-US").
  const isoMatch = normalized.match(/^[a-z]{2}(?:(?:-|_)[a-z]{2})?$/i);
  if (isoMatch) {
    return NAME_TO_CODE.get(normalized.slice(0, 2)) ?? (normalized.slice(0, 2) as LanguageCode);
  }

  return undefined;
}
