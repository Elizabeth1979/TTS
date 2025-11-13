"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAudioPlayer, type PlayResult } from "@/hooks/useAudioPlayer";
import { getErrorMessage, readJsonSafe } from "@/lib/http";
import { LANGUAGE_OPTIONS, type LanguageCode, type LanguageOption } from "@/lib/languages";

// Character limits based on model capabilities
const CHAR_LIMIT_HEBREW = 3_000; // eleven_v3 model
const CHAR_LIMIT_OTHER = 30_000; // eleven_turbo_v2_5 model

function getCharacterLimit(language: LanguageCode): number {
  return language === "he" ? CHAR_LIMIT_HEBREW : CHAR_LIMIT_OTHER;
}

function getModelName(language: LanguageCode): string {
  return language === "he" ? "Eleven v3" : "Turbo v2.5";
}

interface VoiceOption {
  id: string;
  name: string;
  description?: string;
  language?: string;
  languageCode?: LanguageCode;
  accent?: string;
  previewUrl?: string;
}

interface HistoryItem {
  id: string;
  text: string;
  voiceName: string;
  createdAt: string;
  audioSrc: string;
}

interface VoicesResponse {
  voices: VoiceOption[];
}

const MAX_HISTORY = 5;
const AUDIO_BLOCKED_MESSAGE = "Audio ready. Tap play to listen.";

export function TtsStudio() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState<LanguageCode>("he");
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [stability, setStability] = useState(0.55);
  const [similarityBoost, setSimilarityBoost] = useState(0.85);
  const [optimizeLatency, setOptimizeLatency] = useState<0 | 1 | 2>(1);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const { audioRef, play } = useAudioPlayer();

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  useEffect(() => {
    let isMounted = true;

    async function loadVoices() {
      try {
        setError(null);
        const response = await fetch("/api/voices", { cache: "no-store" });
        const payload = await readJsonSafe<VoicesResponse>(response);

        if (!response.ok || !payload) {
          const message = getErrorMessage(response, payload, "Unable to load voices.");
          throw new Error(message);
        }

        if (!isMounted) {
          return;
        }

        const normalized = dedupeVoices(payload.voices);
        setVoices(normalized);

        if (!selectedVoiceId && normalized.length > 0) {
          const matchingVoice = normalized.find((voice) => voice.languageCode === language);
          setSelectedVoiceId((matchingVoice ?? normalized[0]).id);
        }
      } catch (err) {
        console.error("[tts-studio] Failed to load voices", err);
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "We could not reach the ElevenLabs API. Check your API key.",
          );
        }
      }
    }

    void loadVoices();

    return () => {
      isMounted = false;
    };
  }, [language, selectedVoiceId]);

  const filteredVoices = useMemo(() => {
    if (language === "auto") {
      return voices;
    }
    return voices.filter((voice) => voice.languageCode === language);
  }, [language, voices]);

  useEffect(() => {
    if (filteredVoices.length === 0) {
      return;
    }
    if (!selectedVoiceId || !filteredVoices.some((voice) => voice.id === selectedVoiceId)) {
      setSelectedVoiceId(filteredVoices[0].id);
    }
  }, [filteredVoices, selectedVoiceId]);

  useEffect(() => {
    setText("");
  }, [language]);

  const handlePlaybackStatus = useCallback(
    (status: PlayResult) => {
      if (status === "blocked") {
        setError(AUDIO_BLOCKED_MESSAGE);
      } else if (status === "played") {
        setError(null);
      }
    },
    [],
  );

  const currentCharLimit = useMemo(() => getCharacterLimit(language), [language]);
  const currentModel = useMemo(() => getModelName(language), [language]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedVoiceId) {
        setError("Please select a voice first.");
        return;
      }

      // Validate text length against model limit
      if (text.length > currentCharLimit) {
        setError(
          `Text is too long for ${currentModel}. Maximum ${currentCharLimit.toLocaleString()} characters allowed.`
        );
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            voiceId: selectedVoiceId,
            language,
            stability,
            similarityBoost,
            optimizeStreamingLatency: optimizeLatency,
          }),
        });

        if (!response.ok) {
          const payload = await readJsonSafe(response);
          const message = getErrorMessage(response, payload, "Speech synthesis failed.");
          throw new Error(message);
        }

        const blob = await response.blob();
        const dataUrl = URL.createObjectURL(blob);
        setAudioSrc(dataUrl);

        const playbackStatus = await play(dataUrl);
        handlePlaybackStatus(playbackStatus);

        const voiceName = voices.find((voice) => voice.id === selectedVoiceId)?.name ?? "Unknown";
        setHistory((current) => {
          const entry: HistoryItem = {
            id: crypto.randomUUID(),
            text,
            voiceName,
            createdAt: new Date().toISOString(),
            audioSrc: dataUrl,
          };
          return [entry, ...current].slice(0, MAX_HISTORY);
        });
      } catch (err) {
        console.error("[tts-studio] Synthesis failed", err);
        setError(err instanceof Error ? err.message : "Speech synthesis failed.");
      } finally {
        setIsLoading(false);
      }
    },
    [
      currentCharLimit,
      currentModel,
      handlePlaybackStatus,
      language,
      optimizeLatency,
      play,
      selectedVoiceId,
      similarityBoost,
      stability,
      text,
      voices,
    ],
  );

  const handleHistoryPlay = useCallback(
    async (item: HistoryItem) => {
      setAudioSrc(item.audioSrc);
      const playbackStatus = await play(item.audioSrc);
      handlePlaybackStatus(playbackStatus);
    },
    [handlePlaybackStatus, play],
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-elevated backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Talk to me</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Generate natural-sounding speech in multiple languages
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-elevated backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <Field
              id="language"
              label="1. Choose a language"
              helper="Auto detect will use the voice's default."
            >
              {({ labelId, helperId }) => (
                <Select
                  id="language"
                  labelledBy={labelId}
                  describedBy={helperId}
                  value={language}
                  options={LANGUAGE_OPTIONS}
                  onChange={(value) => setLanguage(value as LanguageCode)}
                />
              )}
            </Field>

            <Field
              id="voice"
              label="2. Pick a voice"
              helper={
                filteredVoices.length
                  ? "Preview your favourite voices and pin the best ones."
                  : "No voices detected for this language. Try Auto or fetch new voices."
              }
            >
              {({ labelId, helperId }) => (
                <VoiceSelect
                  voices={filteredVoices.length ? filteredVoices : voices}
                  selectedVoiceId={selectedVoiceId}
                  onChange={setSelectedVoiceId}
                  labelledBy={labelId}
                  describedBy={helperId}
                />
              )}
            </Field>

            <Field
              id="script"
              label="3. Enter your script"
              helper={`Up to ${currentCharLimit.toLocaleString()} characters using ${currentModel}. ${text.length.toLocaleString()}/${currentCharLimit.toLocaleString()} characters used.`}
            >
              {({ labelId, helperId }) => {
                const isOverLimit = text.length > currentCharLimit;
                return (
                  <textarea
                    id="script"
                    aria-labelledby={labelId}
                    aria-describedby={helperId}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={6}
                    placeholder="Type or paste the text you want to hear..."
                    className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm shadow-inner outline-none transition focus:ring-2 dark:bg-slate-950/80 ${
                      isOverLimit
                        ? "border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-200 dark:border-red-500/40 dark:bg-red-950/20 dark:text-red-100 dark:focus:border-red-400 dark:focus:ring-red-500/30"
                        : "border-slate-200 bg-white text-slate-900 focus:border-cyan-500 focus:ring-cyan-200 dark:border-slate-700 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/30"
                    }`}
                    spellCheck={false}
                    aria-invalid={isOverLimit}
                  />
                );
              }}
            </Field>

            <Field
              id="style"
              label="4. Voice style"
              helper="Fine-tune stability and similarity. Higher similarity keeps the original voice tone."
            >
              {({ helperId }) => (
                <>
                  <div
                    className="grid gap-4 md:grid-cols-2"
                    role="group"
                    aria-describedby={helperId}
                  >
                    <Slider
                      id="stability"
                      label={`Stability ${Math.round(stability * 100)}%`}
                      value={stability}
                      onChange={setStability}
                    />
                    <Slider
                      id="similarity"
                      label={`Similarity boost ${Math.round(similarityBoost * 100)}%`}
                      value={similarityBoost}
                      onChange={setSimilarityBoost}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200">
                    <span>Optimize streaming latency</span>
                    <LatencySelect
                      id="latency"
                      value={optimizeLatency}
                      onChange={setOptimizeLatency}
                    />
                  </div>
                </>
              )}
            </Field>

            {error ? <ErrorNotice ref={errorRef} message={error} /> : null}

            <button
              type="submit"
              disabled={
                isLoading || !text.trim() || !selectedVoiceId || text.length > currentCharLimit
              }
              className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold tracking-wide text-slate-900 shadow-lg shadow-cyan-500/40 transition hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-950 dark:focus-visible:ring-offset-slate-900"
            >
              {isLoading ? "Generating…" : "Generate speech"}
            </button>
          </form>
        </section>

        <aside className="flex flex-col gap-6">
          <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-elevated backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Preview</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Your latest output appears here once ready.
            </p>
            <AudioPlayer audioRef={audioRef} src={audioSrc} />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-elevated backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Recent renders</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Tap an item to replay it instantly.
            </p>
            <div className="mt-4 grid gap-3" role="list">
              {history.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Your renders will show up here.
                </p>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handleHistoryPlay(item)}
                    className="group flex flex-col gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-700 transition hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-white hover:shadow dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:border-cyan-400/60 dark:hover:bg-slate-900"
                    role="listitem"
                  >
                    <span className="flex items-center justify-between text-sm font-medium">
                      {item.voiceName}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {item.text}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  helper?: string;
  children: (props: { labelId: string; helperId?: string }) => ReactNode;
}

function Field({ id, label, helper, children }: FieldProps) {
  const labelId = `${id}-label`;
  const helperId = helper ? `${id}-helper` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {label}
      </span>
      {children({ labelId, helperId })}
      {helper ? (
        <span id={helperId} className="text-xs text-slate-500 dark:text-slate-400">
          {helper}
        </span>
      ) : null}
    </div>
  );
}

interface SelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: LanguageOption[];
  labelledBy: string;
  describedBy?: string;
}

function Select({ id, value, onChange, options, labelledBy, describedBy }: SelectProps) {
  return (
    <select
      id={id}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/30"
    >
      {options.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

interface VoiceSelectProps {
  voices: VoiceOption[];
  selectedVoiceId: string;
  onChange: (voiceId: string) => void;
  labelledBy: string;
  describedBy?: string;
}

function VoiceSelect({
  voices,
  selectedVoiceId,
  onChange,
  labelledBy,
  describedBy,
}: VoiceSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listId = `${labelledBy}-listbox`;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
    return undefined;
  }, [isOpen]);

  if (!voices.length) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300"
        role="status"
        aria-live="polite"
      >
        No voices available for this filter.
      </div>
    );
  }

  const selectedVoice = voices.find((voice) => voice.id === selectedVoiceId);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-controls={isOpen ? listId : undefined}
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-900 shadow-sm transition hover:border-cyan-500 focus-visible:border-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:border-cyan-400/60 dark:focus-visible:border-cyan-400 dark:focus-visible:ring-cyan-500/30"
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-medium leading-tight">
            {selectedVoice?.name ?? "Select a voice"}
          </span>
          {selectedVoice ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {selectedVoice.language ?? selectedVoice.accent ?? "Language unknown"}
            </span>
          ) : null}
        </div>
        <svg
          className={`h-5 w-5 text-slate-500 transition-transform dark:text-slate-400 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          id={listId}
          role="listbox"
          aria-activedescendant={selectedVoiceId}
          className="absolute z-10 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl ring-1 ring-slate-900/10 backdrop-blur sm:max-h-72 dark:border-slate-700 dark:bg-slate-950/95 dark:ring-slate-900/40"
        >
          {voices.map((voice) => {
            const isActive = voice.id === selectedVoiceId;
            return (
              <button
                key={voice.id}
                id={voice.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseDown={(event) => {
                  event.preventDefault();
                  setIsOpen(false);
                  onChange(voice.id);
                }}
                className={`flex w-full flex-col gap-0.5 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none ${
                  isActive
                    ? "border-cyan-500 bg-cyan-500/10 text-cyan-900 dark:border-cyan-400 dark:bg-cyan-500/20 dark:text-cyan-100"
                    : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900/60"
                }`}
              >
                <span className="text-sm font-medium leading-tight">{voice.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {voice.language ?? voice.accent ?? "Language unknown"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SliderProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  label: string;
}

function Slider({ id, value, onChange, label }: SliderProps) {
  return (
    <label
      htmlFor={id}
      className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200"
    >
      <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(event) => onChange(Number.parseFloat(event.target.value))}
        className="mt-3 accent-cyan-500"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={Number(value.toFixed(2))}
      />
    </label>
  );
}

interface LatencySelectProps {
  id: string;
  value: 0 | 1 | 2;
  onChange: (value: 0 | 1 | 2) => void;
}

function LatencySelect({ id, value, onChange }: LatencySelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(Number(event.target.value) as 0 | 1 | 2)}
      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/30"
    >
      <option value={0}>Quality first (0)</option>
      <option value={1}>Balanced (1)</option>
      <option value={2}>Low latency (2)</option>
    </select>
  );
}

const ErrorNotice = forwardRef<HTMLDivElement, { message: string }>(({ message }, ref) => (
  <div
    ref={ref}
    role="status"
    aria-live="polite"
    tabIndex={-1}
    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200"
  >
    {message}
  </div>
));

ErrorNotice.displayName = "ErrorNotice";

interface AudioPlayerProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  src: string | null;
}

function AudioPlayer({ audioRef, src }: AudioPlayerProps) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
      {src ? (
        <audio
          ref={audioRef}
          controls
          className="w-full"
          aria-label="Generated audio preview"
          preload="auto"
        >
          <source src={src} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Generate speech to preview the audio.
        </p>
      )}
    </div>
  );
}

function dedupeVoices(voices: VoiceOption[]): VoiceOption[] {
  const seen = new Set<string>();
  return voices.filter((voice) => {
    if (seen.has(voice.id)) {
      return false;
    }
    seen.add(voice.id);
    return true;
  });
}
 