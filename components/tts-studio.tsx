'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LANGUAGE_OPTIONS, type LanguageCode, type LanguageOption } from "@/lib/languages";

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

const DEFAULT_TEXT =
  "שלום וברוכים הבאים! זהו דוגמה קולית בעברית שנוצרה באמצעות ElevenLabs. שנה את הטקסט והתחל להאזין.";

const MAX_HISTORY = 5;

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
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadVoices() {
      try {
        setError(null);
        const response = await fetch("/api/voices");
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Unable to load voices");
        }
        const payload = (await response.json()) as VoicesResponse;
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
        console.error(err);
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "We could not reach the ElevenLabs API. Check your API key."
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

  // Clear text when language changes
  useEffect(() => {
    setText("");
  }, [language]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedVoiceId) {
        setError("Please select a voice first.");
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
            optimizeStreamingLatency: optimizeLatency
          })
        });

        if (!response.ok) {
          const payload = await response.json();
          throw new Error(
            payload?.error?.issues?.text?.[0] ??
              payload?.error?.error ??
              payload?.error ??
              "Speech synthesis failed"
          );
        }

        const contentType = response.headers.get("content-type");
        if (contentType?.includes("audio") && response.body) {
          // Collect all chunks - HTML5 audio needs complete MP3 file
          const blob = await response.blob();
          const dataUrl = URL.createObjectURL(blob);

          setAudioSrc(dataUrl);
          setIsLoading(false);

          // Play audio
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.load();
              audioRef.current.play().catch((err) => {
                console.error("Failed to autoplay audio:", err);
              });
            }
          }, 50);

          const voiceName = voices.find((voice) => voice.id === selectedVoiceId)?.name ?? "Unknown";

          setHistory((current) => {
            const entry: HistoryItem = {
              id: crypto.randomUUID(),
              text,
              voiceName,
              createdAt: new Date().toISOString(),
              audioSrc: dataUrl
            };
            return [entry, ...current].slice(0, MAX_HISTORY);
          });
        } else {
          throw new Error("Unexpected response format");
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Speech synthesis failed");
        setIsLoading(false);
      }
    },
    [language, selectedVoiceId, similarityBoost, stability, text, voices, optimizeLatency]
  );

  const handleHistoryPlay = useCallback((item: HistoryItem) => {
    setAudioSrc(item.audioSrc);
    // Force audio reload even if the src is the same
    if (audioRef.current) {
      audioRef.current.load();
      audioRef.current.play().catch((err) => {
        console.error("Failed to play audio:", err);
      });
    }
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40 backdrop-blur-sm">
        <h1 className="text-3xl font-semibold text-white">ElevenLabs Polyglot Studio</h1>
        <p className="mt-2 text-sm text-slate-300">
          Generate natural-sounding speech in multiple languages powered by ElevenLabs. Choose a
          voice, tweak the tone, and preview instantly.
        </p>
      </header>

      <main className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-lg shadow-slate-950/30 backdrop-blur-sm">
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <Field label="1. Choose a language" helper="Auto detect will use the voice's default.">
              <Select
                value={language}
                options={LANGUAGE_OPTIONS}
                onChange={(value) => setLanguage(value as LanguageCode)}
              />
            </Field>

            <Field
              label="2. Pick a voice"
              helper={
                filteredVoices.length
                  ? "Preview your favourite voices and pin the best ones."
                  : "No voices detected for this language. Try Auto or fetch new voices."
              }
            >
              <VoiceSelect
                voices={filteredVoices.length ? filteredVoices : voices}
                selectedVoiceId={selectedVoiceId}
                onChange={setSelectedVoiceId}
              />
            </Field>

            <Field
              label="3. Enter your script"
              helper="Up to 5,000 characters. Paste Hebrew or any supported language."
            >
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={6}
                placeholder="Type or paste the text you want to hear..."
                className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-inner outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
                spellCheck={false}
              />
            </Field>

            <Field
              label="4. Voice style"
              helper="Fine-tune stability and similarity. Higher similarity keeps the original voice tone."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Slider
                  label={`Stability ${Math.round(stability * 100)}%`}
                  value={stability}
                  onChange={setStability}
                />
                <Slider
                  label={`Similarity boost ${Math.round(similarityBoost * 100)}%`}
                  value={similarityBoost}
                  onChange={setSimilarityBoost}
                />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm">
                <span className="text-slate-300">Optimize streaming latency</span>
                <LatencySelect value={optimizeLatency} onChange={setOptimizeLatency} />
              </div>
            </Field>

            {error ? (
              <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isLoading || !text.trim() || !selectedVoiceId}
              className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold tracking-wide text-slate-950 shadow-lg shadow-cyan-500/40 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Generating…" : "Generate speech"}
            </button>
          </form>
        </section>

        <aside className="flex flex-col gap-6">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-lg shadow-slate-950/30">
            <h2 className="text-xl font-semibold text-white">Preview</h2>
            <p className="mt-1 text-sm text-slate-400">
              Your latest output appears here once ready.
            </p>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              {audioSrc ? (
                <audio ref={audioRef} controls className="w-full">
                  <source src={audioSrc} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <p className="text-sm text-slate-500">Generate speech to preview the audio.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-lg shadow-slate-950/30">
            <h2 className="text-xl font-semibold text-white">Recent renders</h2>
            <p className="mt-1 text-sm text-slate-400">Tap an item to replay it instantly.</p>
            <div className="mt-4 grid gap-3">
              {history.length === 0 ? (
                <p className="text-sm text-slate-500">Your renders will show up here.</p>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleHistoryPlay(item)}
                    className="group flex flex-col gap-1 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-left transition hover:border-cyan-400/60 hover:bg-slate-900/60"
                  >
                    <span className="flex items-center justify-between text-sm font-medium text-slate-200">
                      {item.voiceName}
                      <span className="text-xs text-slate-500">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-xs text-slate-400">{item.text}</span>
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
  label: string;
  helper?: string;
  children: React.ReactNode;
}

function Field({ label, helper, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      {children}
      {helper ? <span className="text-xs text-slate-500">{helper}</span> : null}
    </label>
  );
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: LanguageOption[];
}

function Select({ value, onChange, options }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
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
}

function VoiceSelect({ voices, selectedVoiceId, onChange }: VoiceSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  if (!voices.length) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
        No voices available for this filter.
      </div>
    );
  }

  const selectedVoice = voices.find((voice) => voice.id === selectedVoiceId);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Selected voice display / Dropdown trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-left text-sm text-slate-100 outline-none transition hover:border-cyan-400/60 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-medium leading-tight">
            {selectedVoice?.name ?? "Select a voice"}
          </span>
          {selectedVoice && (
            <span className="text-xs text-slate-400">
              {selectedVoice.language ?? selectedVoice.accent ?? "Language unknown"}
            </span>
          )}
        </div>
        <svg
          className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown list */}
      {isOpen && (
        <div className="absolute z-10 mt-2 grid w-full max-h-60 gap-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/95 p-2 shadow-xl backdrop-blur-sm">
          {voices.map((voice) => {
            const isActive = voice.id === selectedVoiceId;
            return (
              <button
                key={voice.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(false);
                  onChange(voice.id);
                }}
                className={`flex flex-col gap-0.5 rounded-xl border px-4 py-3 text-left transition ${
                  isActive
                    ? "border-cyan-400/80 bg-cyan-500/10 text-cyan-100"
                    : "border-transparent bg-transparent text-slate-200 hover:border-slate-700 hover:bg-slate-900/60"
                }`}
              >
                <span className="text-sm font-medium leading-tight">{voice.name}</span>
                <span className="text-xs text-slate-400">
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
  value: number;
  onChange: (value: number) => void;
  label: string;
}

function Slider({ value, onChange, label }: SliderProps) {
  return (
    <label className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(event) => onChange(Number.parseFloat(event.target.value))}
        className="mt-3"
      />
    </label>
  );
}

interface LatencySelectProps {
  value: 0 | 1 | 2;
  onChange: (value: 0 | 1 | 2) => void;
}

function LatencySelect({ value, onChange }: LatencySelectProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(Number(event.target.value) as 0 | 1 | 2)}
      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
    >
      <option value={0}>Quality first (0)</option>
      <option value={1}>Balanced (1)</option>
      <option value={2}>Low latency (2)</option>
    </select>
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
