# PRD — ももすもも (Momo Sumomo) mobile game

## Original Problem Statement
"Build a mobile app identical to clobagames.com." User then uploaded the real
`PlumApp_4.0.1.ipa` (the game ももすもも from clobagames.com) and said "this game".
Goal: recreate that game as an Expo mobile app.

## What the game is
A fast reaction game. A vertical stack of fruit beads — peaches (もも, orange) and
plums (すもも, deep red) — drops from the top. The BOTTOM bead is the current target.
Two large buttons (もも / すもも) at the bottom. Tap the matching button to clear the
bottom bead (score +1); a new bead drops in from the top. A per-fruit timer (speed bar)
shrinks and gets shorter as score rises. A WRONG tap OR a timeout = GAME OVER.

## Architecture
- Frontend: Expo Router (React Native), Reanimated animations, expo-linear-gradient
  fruit rendering (original art, no copied assets), expo-haptics feedback.
- Backend: FastAPI + MongoDB (motor). Open global leaderboard, no auth.
- Local best score via `@/src/utils/storage` (key `momo_best_score`).

## Screens / Routes
- `/` (index.tsx): Title — title, best pill, あそぶ / あそびかた / ランキング.
- `/game`: gameplay + game-over overlay (score, best, NEW BEST, name+登録, もう一度, ホーム, ランキング).
- `/howto`: rules (JP + EN) with fruit cards.
- `/ranking`: global leaderboard (pull-to-refresh, medals for top 3, empty/error states).

## Backend API
- GET  /api/                → health
- POST /api/scores          → {name, score} (name empty→ゲスト, >16 truncated; score clamped ≥0)
- GET  /api/scores/top?limit → top scores desc (no _id leak)
- GET  /api/scores/rank?score → {rank, total}

## Difficulty
`durationForScore(score) = max(430, 1500 - score*22)` ms per fruit.

## Implemented (2026-07-14) — MVP complete, all tests pass
- Full gameplay loop, timer/speed ramp, wrong-tap & timeout game over.
- Local best persistence + NEW BEST detection.
- Global leaderboard (submit + view), howto, title.
- 12/12 backend tests + all deterministic frontend flows verified.

## Backlog
- P1: sound effects (currently haptics only — needs royalty-free audio assets).
- P1: share score card (screenshot / deep link) for virality.
- P2: combo/streak multiplier & bonus fruit; daily challenge.
- P2: rank feedback on game over ("You're #N in the world!") using /api/scores/rank.
- P2: custom app icon / splash matching the fruit theme.

## Next tasks
- Add sound + share-score feature; surface world rank on game over.
