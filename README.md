# Forge

Forge is a local-first challenge and maintenance app rebuilt from the supplied reference architecture without a Base44 dependency.

## Architecture
React + Vite → AppProvider → domain engine → local persistence. The core loop needs no auth, backend, API, or network.

## Run
npm install
npm run dev

## Android
npm run android:build
