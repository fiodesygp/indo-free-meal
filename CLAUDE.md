# MBG: The Four-Hour Race (repo: indo-free-meal)

Single-file educational simulation (index.html) about Indonesia's Makan Bergizi Gratis school-meal supply chain.

## Structure
- Section 1: tunable data tables (PARAMS, REGIONS, MENUS…). Every number is labelled sourced | derived | estimate.
- Section 2: engine (pure functions over state G, no DOM).
- Section 3: UI (VIEWS, A actions, render()).
- Section 4: dev panel, enabled with ?dev=1.
- Translations: I18N, GLOSS_L, INFO_L (en / id). English is the source; Bahasa Indonesia is the only translation. Every player-facing string goes through T().

## Chapters (the learning ladder)
Five chapters, played in order, shown to players in two parts (internally they stay Ch1–5):
- **Part 1, Supply Chain Basics:** Practice 1 The Grocery Store (Ch1), Practice 2 The Bakery (Ch2).
- **Gate:** "Ready for a bigger project?" (the last page of Ch2).
- **Part 2, The MBG Project:** Stage 1 One Kitchen, One Morning (Ch3), Stage 2 One Region (Ch4), Stage 3 Two Years (Ch5).

 Ch1–2 are warm-ups with no concept text; they set the "safety stock saved me" instinct that Ch3 breaks. Ch5 is the full simulation (PERIODS = 4 semesters, two years; keep it, and if Ch5 runs long, cut events per period, never semesters).

- **State:** `G.chapter`; `G.wu` holds warm-up and Ch3 state; `G.carry` holds what a chapter hands forward; `G.chTimes` holds per-chapter timings. `resetGame()` restarts the current chapter and keeps those three. `chapterDefaults()` (start state) and `chapterCarry(n)` (hand-forward) live in Section 2.
- **Navigation:** `CHAPTER_PAGES` (Section 3) gives each chapter its own page list under the same Brief / Plan / Run / Results categories. `setChapter(n)` swaps `PHASES`, `NAV_CATS` and `YEAR_PHASE0`, and `render()` calls it first. Ch1, Ch3 and Ch4 end on a `bridge` page, Ch2 on the `gate` page, and Ch5 on the debrief; `A.nextChapter()` moves on.
- **Parts:** `PARTS` (part titles and their chapters), `partOf(n)` (1 or 2), `inPart(n)`, `chLabel(n)` ("Practice 2", "Stage 1") and `chPos(n)` ("The MBG Project · Stage 1 of 3") build every player-facing chapter label. Never show the internal 1–5 numbers to players. `chapterRow()` draws the progress row: two labelled groups with a divider (marked while on the gate), with chips numbered within their part. On phones it shows numbers only, plus a caption naming the current part and chapter. Stage 1's brief opens with a "Part 2 · The MBG Project" header card.
- **Gate:** `VIEWS.gate` (one screen, existing card and button styles, no quiz or scoring) shows three takeaways (`GATE_TAKEAWAYS`), what comes next, and two buttons: start the MBG Project (`A.nextChapter()`) or replay the basics (`A.replayBasics()`, which restarts Practice 1). The dev jump has a "Gate" target.
- **Engine scope:** `CHAPTER_SCOPE` (Section 1), read through `CH()`: periods (`NP()`), events and weather on or off, number of provinces. Ch3–4 reuse the MBG engine with controls gated; do not fork it.
- **One curve:** Ch2 "Freshness" and Ch3–5 "Safety" are the same `compS()` (S = 1 until λ, then 0.5^((t − λ)/h)). Never write a second implementation.
- **Warm-up parameters:** `WARMUP` (Section 1), all `src:'estimate'`, read with `W(id)`. Chapter engines: `groceryRound()` (Ch1), `bakeryRound()` (Ch2), `morningOps()` (Ch3, wraps `kitchenOps()` with an optional per-run menu, `plan.runMenu`).
- **Run shell:** Ch1–3 animate through the warm-up animator (`wuShell` / `wuStart` / `WU_PAINT` / `WU_END` / `WU_LED` / `WU_EVENT`). It uses the same track, readouts, controls and overlay classes as the semester run (`simView`). Results are computed before the animation, so the animation is display only.
- **Ledger:** `renderHeader()` shows `ledgerWarmup()` tiles in Ch1–3 and the three MBG pairs in Ch4–5.
- **Feedback:** the record and run log include `chapter` (1–5), `part` (1 or 2), `chapterMinutes` (accumulated across attempts: `G.chTimes[n]` keeps `acc` for closed attempts and `start`/`end` for the open one), `basicsReplays` (times "Replay the basics" was used), `basicsFirstMin` (first-attempt minutes for Practice 1–2, frozen at the first replay) and `skippedWarmups`.

### Gating map
| | Practice 1 (Ch1) | Practice 2 (Ch2) | Stage 1 (Ch3) | Stage 2 (Ch4) | Stage 3 (Ch5) |
|---|---|---|---|---|---|
| Ledger | Stockouts · Waste | Delivered · Freshness lost | Delivered, Exposure (food safety only) | all three pairs | all three pairs |
| Brief facts (`BRIEF_ITEMS`) | none | none | clock + explainer | unit, who is fed, background (optional) | scale, mission |
| Decisions | order qty + safety stock per product | trucks, run order, croissant or sourdough per group | run count, meal per run | province (one), radius, size, build/rent, vehicles, sourcing, weekly menu | everything in the full game |
| Fixed | – | – | 1 vehicle, Teluk Lumba kitchen (30-min leg) | posture "balanced", activation 1, budget split automatic, no events or weather | – |
| Carries forward | – | – | run menus → Ch4 week | regency, kitchens, sourcing, menu → Ch5 first region | – |
| Food-cost ceiling | – | – | morning average: Σ runs (portions × meal food cost) ≤ fed × Rp10,000 (`FOOD_CEILING`); over it, "Run the morning" is disabled; not scored | – | – |

The Ch3 food-cost ceiling is a modelling decision, not a sourced rule: the sourced Rp10,000 raw-material ceiling is applied as an average per portion across the whole morning (`morningOps()` returns `food`, `foodAvg`, `overCeiling`). It applies in Ch3 only; Ch4–5 keep the existing menu-page handling of the ceiling.

### ALLOW_SKIP_WARMUPS
`ALLOW_SKIP_WARMUPS` (Section 1) defaults to `false`. When `true`, Practice 1–2 show a "Skip the basics →" button (`A.skipWarmups()`), which sets `G.carry.skipped` and starts Stage 1. Stage 1's brief then adds the safety-stock line (`C3_SKIP_LINE`, translated).

## Local development
- `npm install` once (browser-sync is the only dependency, a devDependency).
- `npm run dev` serves the project root at http://localhost:3000/ with live reload on *.html, *.css, *.js and *.md. `npm run dev:panel` does the same and opens /?dev=1.
- No npm: `python3 -m http.server 8000`, then open http://localhost:8000.
- Deployment stays a plain static index.html on Vercel: do not add a build or start script, Vite or a framework.

## Rules
- Make surgical edits. Never rewrite the whole file.
- Any new player-facing string must be added to I18N with an id translation (EN / ID only; Spanish was removed). Check new work with the five-chapter walk in EN and ID.
- Keep the Asphalt design tokens in :root; do not hard-code new colours.
- After changes, check the page still loads and ?dev=1 autoplay runs without errors. The dev panel can jump to any chapter and autoplay any chapter (`autoplayChapter(n)`). Ch5's trap scenarios must give the same results unless the MBG engine was changed on purpose.
