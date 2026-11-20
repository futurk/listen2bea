# Listen2Bea

Practice listening comprehension with [Tatoeba](https://tatoeba.org) sentences.

- **Freeplay** — continuous playback of an original sentence, its translation, and an optional repeat, with an adjustable pause.
- **Dictation** — listen to a sentence, type it, and compare your answer with the expected text.

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
  hooks/        sentence queue, clip player, persisted settings
  lib/          Tatoeba client, types, languages, storage
```

## Notes

- Tatoeba recordings whose author disallows reuse outside Tatoeba return HTTP 403. These have an empty `license` field and are filtered out before they reach the player.
- Audio author attribution is shown while practicing; the footer links back to Tatoeba.
