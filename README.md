# ElevenLabs Polyglot TTS Studio

Generate high quality speech in Hebrew and other languages using ElevenLabs. This project is a Next.js 14 app router application with a typed API layer and Tailwind CSS UI.

## Getting started

1. Install dependencies:

   ```bash
   pnpm install
   # or
   npm install
   ```

2. Copy the example environment file and add your ElevenLabs API key:

   ```bash
   cp .env.local.example .env.local
   ```

   ```env
   ELEVENLABS_API_KEY=your_xi_api_key_here
   ELEVENLABS_MODEL_ID=eleven_multilingual_v2 # optional override
   ELEVENLABS_OPTIMIZE_LATENCY=1              # optional (0,1,2)
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Visit http://localhost:3000

## Features

- ElevenLabs integration with configurable stability, similarity, and latency controls.
- Language-aware voice filtering with a Hebrew-first default experience.
- Recent render history with one-click replay.
- Typed API routes with runtime validation (Zod).
- Tailwind-based dark UI ready for customization.

## Provider setup notes

- ElevenLabs returns voices available to the authenticated account. Use the "Auto" language option or tag your voices inside ElevenLabs Studio to improve filtering.
- The app uses the `eleven_multilingual_v2` model by default. Override `ELEVENLABS_MODEL_ID` if you have access to newer beta models.
- ElevenLabs rate limits API usage. Cache frequent scripts if you expect high traffic.

## Next steps

- Add authentication & user-specific history storage.
- Persist render history + caching in a database (e.g., Supabase or Redis).
- Enable streaming playback by switching to the ElevenLabs streaming endpoint.
- Add a background job queue for longer scripts.
