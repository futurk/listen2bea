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

Freeplay builds the whole sequence (original, pause, translation, pause, repeat) into an `expo-audio` **native playlist**. The pauses are short silence tracks in `assets/audio/`, so the playlist keeps advancing while JavaScript is suspended and the screen is locked. New sentence pages are still fetched from JavaScript; if the buffered queue runs out while the app is suspended, playback stops until the app is active again.

## Notes

- Tatoeba recordings whose author disallows reuse outside Tatoeba return HTTP 403. These have an empty `license` field and are filtered out before they reach the player.
- Audio author attribution is shown while practicing; the footer links back to Tatoeba.
