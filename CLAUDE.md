# MBG: The Four-Hour Race (repo: indo-free-meal)

Single-file educational simulation (index.html) about Indonesia's Makan Bergizi Gratis school-meal supply chain.

## Structure
- Section 1: tunable data tables (PARAMS, REGIONS, MENUS…). Every number is labelled sourced | derived | estimate.
- Section 2: engine (pure functions over state G, no DOM).
- Section 3: UI (VIEWS, A actions, render()).
- Section 4: dev panel, enabled with ?dev=1.
- Translations: I18N, GLOSS_L, INFO_L (en / id). English is the source; Bahasa Indonesia is the only translation. Every player-facing string goes through T().

## Chapters (the learning ladder)
Five chapters, played in order, shown to players in two parts (internally they stay Ch1–5), after an entry:
- **Entry (Ch0, not a part):** the Intro page (the "What is MBG?" explainer, moved here from Stage 1's brief), then the Choice page: "Learn supply chain basics first" (path `basics`, starts Practice 1) or "Go straight to the MBG Project" (path `direct`, starts Stage 1; Part 1 never opens). No default; the choice page is the only way to skip the basics.
- **Part 1, Supply Chain Basics:** Practice 1 The Grocery Store (Ch1), Practice 2 The Bakery (Ch2).
- **Gate:** "Ready for the MBG Project?" (the last page of Ch2, basics path only).
- **Part 2, The MBG Project:** Stage 1 One Kitchen, One Morning (Ch3), Stage 2 One Region (Ch4), Stage 3 Two Years (Ch5).

 Ch1–2 are warm-ups with no concept text; they set the "safety stock saved me" instinct that Ch3 breaks. Ch5 is the full simulation (PERIODS = 4 semesters, two years; keep it, and if Ch5 runs long, cut events per period, never semesters).

- **State:** `G.chapter`; `G.wu` holds warm-up and Ch3 state; `G.carry` holds what a chapter hands forward; `G.chTimes` holds per-chapter timings (Ch1–5; the entry pages are not timed). `G.carry.path` is `'basics'`, `'direct'` or unset (still on the entry). The game boots on Ch0. `resetGame()` restarts the current chapter and keeps those three. `chapterDefaults()` (start state) and `chapterCarry(n)` (hand-forward) live in Section 2.
- **Navigation:** `CHAPTER_PAGES` (Section 3) gives each chapter its own page list under the same Brief / Plan / Run / Results categories. `setChapter(n)` swaps `PHASES`, `NAV_CATS` and `YEAR_PHASE0`, and `render()` calls it first. Ch1, Ch3 and Ch4 end on a `bridge` page, Ch2 on the `gate` page, and Ch5 on the debrief; `A.nextChapter()` moves on.
- **Parts:** `PARTS` (part titles and their chapters), `partOf(n)` (1 or 2; `null` for Ch0), `inPart(n)`, `chLabel(n)` ("Practice 2", "Stage 1") and `chPos(n)` ("The MBG Project · Stage 1 of 3") build every player-facing chapter label. Never show the internal 1–5 numbers to players. `chapterRow()` draws the progress row: an Intro chip, then two labelled groups with a divider (marked while on the gate), with chips numbered within their part. On the direct path Part 1's chips stay visible, greyed out with a dashed number and a "skipped" label. On phones it shows numbers only, plus a caption naming the current part and chapter. Stage 1's brief opens with a "Part 2 · The MBG Project" header card, then the clock card; on the direct path only, it adds the safety-stock line (`C3_SKIP_LINE`, translated).
- **Entry:** `VIEWS.intro` and `VIEWS.choice`; each choice card has its own button, calling `A.choosePath('basics'|'direct')`, which sets `G.carry.path` and starts Ch1 or Ch3. Restart on the entry goes back to the intro.
- **Gate:** `VIEWS.gate` (one screen, existing card and button styles, no quiz or scoring) shows three takeaways (`GATE_TAKEAWAYS`), what comes next, and two buttons: "Continue to the MBG Project" (primary, `A.nextChapter()`) or "Replay the basics" (secondary, `A.replayBasics()`, which restarts Practice 1). The dev jump has "Intro", "Choice", "Gate" and "Stage 1 on the direct path" targets; jumps to Ch1, Ch2 or the gate set the path to `basics`.
- **Engine scope:** `CHAPTER_SCOPE` (Section 1), read through `CH()`: periods (`NP()`), events and weather on or off, number of provinces. Ch3–4 reuse the MBG engine with controls gated; do not fork it.
- **One curve:** Ch2 "Freshness" and Ch3–5 "Safety" are the same `compS()` (S = 1 until λ, then 0.5^((t − λ)/h)). Never write a second implementation.
- **Warm-up parameters:** `WARMUP` (Section 1), all `src:'estimate'`, read with `W(id)`. Chapter engines: `groceryRound()` (Ch1), `bakeryRound()` (Ch2), `morningOps()` (Ch3, wraps `kitchenOps()` with an optional per-run menu, `plan.runMenu`).
- **Run shell:** Ch1–3 animate through the warm-up animator (`wuShell` / `wuStart` / `WU_PAINT` / `WU_END` / `WU_LED` / `WU_EVENT`). It uses the same track, readouts, controls and overlay classes as the semester run (`simView`). Results are computed before the animation, so the animation is display only.
- **Brief diagrams:** Practice 1–2's briefs open with an inline-SVG diagram (`groceryDiagram()`, `bakeryDiagram()`; helpers `dgLab`, `dgArrow`, `DG_ICON`, `dgSay`) in the `.dg-*` token classes: no images, emoji or libraries. Each draws a wide layout (`.dg-w`) and a top-to-bottom phone layout (`.dg-n`) with a viewBox near its rendered width, so labels stay ≥ 11 px at 390 px. Numbers come from `W()`, `B_TRUCK_OPTIONS`, `bakeryAge()` and `compS()`.
- **Ledger:** `renderHeader()` shows no ledger on the entry, `ledgerWarmup()` tiles in Ch1–3 and the three MBG pairs in Ch4–5.
- **Feedback:** the record and run log include `chapter` (1–5), `part` (1 or 2), `path` (`'basics'` or `'direct'`), `chapterMinutes` (keys 1–5, `null` for a chapter never opened, so Part 1 on the direct path; accumulated across attempts: `G.chTimes[n]` keeps `acc` for closed attempts and `start`/`end` for the open one), `basicsReplays` (times "Replay the basics" was used), `basicsFirstMin` (first-attempt minutes for Practice 1–2, frozen at the first replay; `null` on the direct path). `skippedWarmups` was removed; `path` replaces it.

### Gating map
| | Practice 1 (Ch1) | Practice 2 (Ch2) | Stage 1 (Ch3) | Stage 2 (Ch4) | Stage 3 (Ch5) |
|---|---|---|---|---|---|
| Ledger | Stockouts · Waste | Delivered · Freshness lost | Delivered, Exposure (food safety only) | all three pairs | all three pairs |
| Brief facts (`BRIEF_ITEMS`) | none (diagram: `groceryDiagram()`) | none (diagram: `bakeryDiagram()`) | clock (the explainer is on the Intro) | unit, who is fed, background (optional) | scale, mission |
| Decisions | order qty + safety stock per product | trucks, run order, croissant or sourdough per group | run count, meal per run | province (one), radius, size, build/rent, vehicles, sourcing, weekly menu | everything in the full game |
| Fixed | – | – | 1 vehicle, Teluk Lumba kitchen (30-min leg) | posture "balanced", activation 1, budget split automatic, no events or weather | – |
| Carries forward | – | – | run menus → Ch4 week | regency, kitchens, sourcing, menu → Ch5 first region | – |
| Food-cost ceiling | – | – | morning average: Σ runs (portions × meal food cost) ≤ fed × Rp10,000 (`FOOD_CEILING`); over it, "Run the morning" is disabled; not scored | – | – |

The Ch3 food-cost ceiling is a modelling decision, not a sourced rule: the sourced Rp10,000 raw-material ceiling is applied as an average per portion across the whole morning (`morningOps()` returns `food`, `foodAvg`, `overCeiling`). It applies in Ch3 only; Ch4–5 keep the existing menu-page handling of the ceiling.

### Skipping the basics
The `ALLOW_SKIP_WARMUPS` flag, `A.skipWarmups()` and `G.carry.skipped` are gone. The only way past Part 1 is the choice page's direct path.

## Local development
- `npm install` once (browser-sync is the only dependency, a devDependency).
- `npm run dev` serves the project root at http://localhost:3000/ with live reload on *.html, *.css, *.js and *.md. `npm run dev:panel` does the same and opens /?dev=1.
- No npm: `python3 -m http.server 8000`, then open http://localhost:8000.
- Deployment stays a plain static index.html on Vercel: do not add a build or start script, Vite or a framework.

## Rules
- Make surgical edits. Never rewrite the whole file.
- Any new player-facing string must be added to I18N with an id translation (EN / ID only; Spanish was removed). Check new work with the five-chapter walk in EN and ID, on both paths (basics and direct).
- Keep the Asphalt design tokens in :root; do not hard-code new colours.
- After changes, check the page still loads and ?dev=1 autoplay runs without errors. The dev panel can jump to any chapter and autoplay any chapter (`autoplayChapter(n)`). Ch5's trap scenarios must give the same results unless the MBG engine was changed on purpose.
