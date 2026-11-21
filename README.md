# Listen2Bea

Practice listening comprehension with [Tatoeba](https://tatoeba.org) sentences.

- **Freeplay** — continuous playback of an original sentence, its translation, and an optional repeat, with an adjustable pause.
- **Dictation** — listen to a sentence, type it, and compare your answer with the expected text.

## Live app

[https://l2b.expo.app](https://l2b.expo.app)

## Inspiration

This project is inspired by Speechling's [listening practice](https://speechling.com/listening) and [dictation practice](https://speechling.com/dictation).

## Stack

- Expo SDK 58 (`expo ~58.0.26`)
- React Native 0.88 / React 19.3
- Expo Router 58 (`src/app`)
- `expo-audio` for playback
- Tatoeba v1 API (`https://api.tatoeba.org/v1`), documented at [api.tatoeba.org/openapi.json](https://api.tatoeba.org/openapi.json)
- TypeScript, ESLint, Jest

## Development

```sh
npm install
npm start        # Expo dev server
npm run web      # run in the browser
npm run typecheck
npm run lint
npm test
npm run export:web
```

Typed routes are generated in `.expo/types` by `expo start` or `expo export`; run one of those once before `npm run typecheck` on a fresh checkout.

Copy `.env.example` to `.env` if you need to override the Tatoeba sentences endpoint. The default is `https://api.tatoeba.org/v1/sentences`.

## Project layout

```
src/
  app/          Expo Router screens (_layout, index, freeplay, dictation)
  components/   small presentational components
  hooks/        sentence queue, native playlist, clip player, settings
  lib/          Tatoeba client, types, languages, storage
```

## Background playback

Freeplay can keep playing while the device is locked, but only in a **development or production build**:

- The `expo-audio` config plugin (`enableBackgroundPlayback: true` in `app.json`) adds the required iOS `audio` background mode and the Android media playback foreground service.
- Config plugins are baked into the native binary at build time, so **Expo Go cannot apply them** and playback will stop when the screen locks there.
- Build a development client with `npx expo run:ios` / `npx expo run:android`, or `eas build --profile development`.

At runtime the app enables the session with `setAudioModeAsync({ shouldPlayInBackground: true })` and keeps lock-screen controls active while a clip is playing.

Freeplay builds the whole sequence (original, pause, translation, pause, repeat) into an `expo-audio` **native playlist**. The pauses are short silence tracks in `assets/audio/`, so the playlist keeps advancing while JavaScript is suspended and the screen is locked.

It never appends to a playlist that is already active, which avoids an upstream Android crash when a lock-screen session sees a timeline change ([expo/expo#52192](https://github.com/expo/expo/issues/52192)). Instead, when the user reaches the last loaded sentence, a **Fetch more sentences** button requests exactly one more page and rebuilds the playlist from the first new sentence. It never fetches more automatically, to limit Tatoeba API usage. When no pages remain, the button shows **No more sentences**.

If a network error interrupts playback, the player enters an error state; pressing Play rebuilds the queue from the current sentence and retries.

## Tatoeba API notes

### Audio hosts

Tatoeba audio is reachable through two hosts with very different behavior.

- `https://audio.tatoeba.org/sentences/{lang}/{sentenceId}.mp3` is the static host. It responds in roughly **0.12–0.16 s**, even for parallel requests, and supports ranged requests. It uses the **sentence** ID, not the audio ID, and only serves that sentence's **first** recording.
- `https://api.tatoeba.org/v1/audios/{audioId}/file` is the endpoint that can address any specific recording. It is slow and variable: during testing, time-to-first-byte was often **2–3 s** for files that are typically only **6–80 KB**, and parallel requests appeared to be serialized at roughly one every 3 seconds.
- The API payload's own `download_url` points at `/v1/audio/{id}/file` (singular), which currently returns 404. The working endpoint uses the plural `audios`.
- The app prefers the static host when the playable recording is the sentence's primary one, and falls back to the API endpoint otherwise.
- The static host does not send CORS headers. It is used only by the `<audio>` element, which does not require CORS; avoid `fetch()`/preloading from it without checking that.
- `HEAD` requests to the API file endpoint were not reliable during testing (they returned 404/redirects), so use `GET` when probing an audio URL.

### Licenses and recordings

- An empty or whitespace `license` means the author does not allow reuse outside Tatoeba. Both audio hosts return HTTP 403 for those recordings.
- The v1 API cannot filter sentences by audio reuse license, so the app requests `include=audios` and filters client-side with `isReusableAudio`.
- A sentence or translation can have multiple recordings. The app keeps only reusable ones. When the first recording is not reusable but several later ones are, it randomly chooses one while preparing the page; otherwise it uses the first reusable recording.
- Audio metadata requires `include=audios`. Requiring a translation with audio also sends `trans:has_audio=yes`.

## Notes

- Audio author attribution is shown while practicing; the footer links back to Tatoeba.
