# MBG: The Four-Hour Race (repo: indo-free-meal)

Single-file educational simulation (index.html) about Indonesia's Makan Bergizi Gratis school-meal supply chain.

## Structure
- Section 1: tunable data tables (PARAMS, REGIONS, MENUS…). Every number is labelled sourced | derived | estimate.
- Section 2: engine (pure functions over state G, no DOM).
- Section 3: UI (VIEWS, A actions, render()).
- Section 4: dev panel, enabled with ?dev=1.
- Translations: I18N, GLOSS_L, INFO_L (en / id). English is the source; Bahasa Indonesia is the only translation. Every player-facing string goes through T().

## Flow
An entry, then the MBG Project's three stages, played in order (internally the stages stay Ch3–5):
- **Entry (Ch0):** Intro (the "What is MBG?" explainer: the narrated, animated scenes, not a video file) → Calibration → Your level. "Start MBG" (`A.startMbg()`) starts Stage 1.
- **The MBG Project:** Stage 1 One Kitchen, One Morning (Ch3), Stage 2 One Region (Ch4), Stage 3 Two Years (Ch5).

Ch5 is the full simulation (PERIODS = 4 semesters, two years; keep it, and if Ch5 runs long, cut events per period, never semesters). Part 1 (the Grocery Store and Bakery warm-ups), the path-choice page and the gate were removed, with `WARMUP`, `W()`, `PARTS`, the brief diagrams, `G.carry.path` and the path lock.

- **State:** `G.chapter`; `G.wu` holds Stage 1 state; `G.carry` holds what a chapter hands forward, plus the calibration (`calib`, `level`, `calibScore`); `G.chTimes` holds per-stage timings (Ch3–5; the entry is not timed). The game boots on Ch0. `resetGame()` restarts the current chapter and keeps those three. `chapterDefaults()` (start state) and `chapterCarry(n)` (hand-forward) live in Section 2.
- **Navigation:** `CHAPTER_PAGES` (Section 3) gives each chapter its own page list under the same Brief / Plan / Run / Results categories. `setChapter(n)` swaps `PHASES`, `NAV_CATS` and `YEAR_PHASE0`, and `render()` calls it first. Ch3 and Ch4 end on a `bridge` page and Ch5 on the debrief; `A.nextChapter()` moves on.
- **Labels:** `STAGES`, `stageOf(n)`, `chLabel(n)` ("Stage 1") and `chPos(n)` ("The MBG Project · Stage 1 of 3") build every player-facing chapter label. Never show the internal 3–5 numbers to players. `chapterRow()` draws the progress row: an Intro chip, a divider, then "The MBG Project" with Stages 1–3. On phones it shows numbers only, plus a caption naming the current stage. Stage 1's brief has the chapter hero, the buffer line (`C3_BUFFER_LINE`: cooked food cannot be held as safety stock) and the clock card.
- **Back:** Back stays inside a chapter and opens earlier pages view-only (banner and nav both say "Continue →" to return). On the entry it is live: it steps back through the calibration questions to the intro. Once a level is assigned there is no Back on the level page and no Back from Stage 1's brief; the intro's Next skips straight to the level page.
- **Engine scope:** `CHAPTER_SCOPE` (Section 1), read through `CH()`: periods (`NP()`), events and weather on or off, number of provinces. Ch3–4 reuse the MBG engine with controls gated; do not fork it.
- **One curve:** "Safety" everywhere is `compS()` (S = 1 until λ, then 0.5^((t − λ)/h)). Never write a second implementation.
- **One batch-per-run price; one Meals forecast:** cooking one batch per run costs `COST_STAGGER_PORTION` (Rp300 a portion, from Meals) wherever it happens, whether a province's plan or a kitchen on a corrective plan. `COST_CORRECTIVE_KITCHEN` is retraining only and reads its value from `COST_TRAINING_KITCHEN` (Rp60M a year, estimate); it was Rp150M for "batches plus retraining", a double count, since the batch cost alone is Rp300 × 2,500 × 200 = Rp150M a year at a standard kitchen. The budget page's Meals forecast (`budgetNeeds`) prices the network the semester will actually run (`semesterNetwork`: openings, suspensions, redirected loads, corrective kitchens) with the engine's own pricing (`mealsAtFullService`), so it equals the engine's planned Meals cost; `npm test` checks this in every trap semester, and against the charged cost when nothing disrupts service.
- **Reproducibility:** the same decisions must give the same run, however long the page has been running. Every random choice in the engine draws from a seeded `rngFrom()` stream; to shuffle, use `shuffleWith(a, r)` (seeded Fisher–Yates), never `sort(() => r() - .5)`: V8 does not promise the same order for an inconsistent comparator, and the order changed once the code was optimised (the flood pick in `drawWeather()` did this until it was fixed). No `Math.random`, dates or timers in Section 2. `npm test` plays every trap on its own seed and 20 salted seeds cold, and again after two warm-ups, and requires identical runs.
- **Incident base rate:** `HAZARD_BASE` (estimate) is 0.015 a kitchen-year, down from 0.03. At 0.03 about a quarter of untouched Beginner paths (26% expected, 10 of 45 observed) had an S1 incident with every portion inside its safe window, so incidents read as random; at 0.015 it is 14% expected (3 of 45). Every trap still fires its pattern. The hazard formula is also written out in the ⓘ explainer (`INFO.hazard`, EN and ID): keep it in step with the constant.
- **Stage 1 engine:** `morningOps()` wraps `kitchenOps()` with an optional per-run menu (`plan.runMenu`). It animates through the morning animator (`wuShell` / `wuStart` / `WU_PAINT` / `WU_END` / `WU_LED` / `WU_EVENT`; the `wu` names date from the warm-ups), which uses the same track, readouts, controls and overlay classes as the semester run (`simView`). Results are computed before the animation, so the animation is display only.
- **Ledger:** `renderHeader()` shows no ledger on the entry, `ledgerWarmup()` tiles in Ch3 and the three MBG pairs in Ch4–5. From the second semester on, each tile shows delta chips against the previous semester (numbers only; none on an unaudited plate value).
- **Debrief patterns:** `trapReport()` lists them in the order of the decision each one judges, set once in `PATTERN_ORDER` (Section 3): Unspent allocation (spending pace, from build and Semester 1), Safe, but not eaten (the weekly menu, set at build), The certification trap (each plan's SLHS choice), The cheap patch (incident responses, during the runs), then Incidents inside the safe window, which judges no decision. A new pattern takes its place in that list.
- **Feedback:** the record and run log include `chapter` (3–5), `level`, `calibScore` (0–6), `calibAnswers` (each an index into that item's options as listed in `CALIB`, `null` if unanswered; never shown to players) and `chapterMinutes` (keys 3–5, `null` for a stage never opened; accumulated across attempts: `G.chTimes[n]` keeps `acc` for closed attempts and `start`/`end` for the open one). `path`, `firstPath`, `pathSwitches`, `part`, `basicsReplays` and `basicsFirstMin` were removed.

### Calibration and display levels
- **Calibration:** `CALIB` (Section 3), six multiple-choice items, one per screen with progress dots, about two minutes. Always "Calibration" / "Kalibrasi", never "test". One point each; `ok` (the correct option) is never rendered, and the player gets no per-item feedback or score, during or after. Item order is fixed; option order is shuffled per item with `Math.random` (`calibState()`), except trailing options pinned with `pin` (Q5's "Either of the above" and "Neither" stay last). `A.calibAnswer(k)` records answers; after the sixth, `calibLevel()` assigns the level: 0–2 Beginner / Pemula, 3–4 Intermediate / Menengah, 5–6 Advanced / Mahir.
- **Level:** `G.carry.level`, read only through `LV()` (Section 3). Assigned once, no override and no retake: it survives Restart and chapter changes. `VIEWS.level` shows the level's name and one-line description (`LEVELS`) and a single "Start MBG" / "Mulai MBG" button.
- **Hard rule: the model is identical at every level.** λ, h, run timing, allocation, the viability floor, incident draws and the seed from the decision vector never read the level. Only Section 3 (rendering, pacing, help text, which controls are open, pre-fill) may read it; Section 2 must not mention it. `npm test` (`tests/invariance.mjs`) plays every Ch5 trap scenario at all three levels and requires identical ledgers, events and seeds with zero level reads, and checks that the forecast never reads the level, never builds the decision-vector seed or calls `Math.random`, and never changes the decisions.
- **What the level changes (Stage 3 unless noted):**

| | Beginner / Pemula | Intermediate / Menengah | Advanced / Mahir |
|---|---|---|---|
| Build-time decisions (region, kitchens, cluster radius, build/rent, vehicles, sourcing) | made at build, pre-filled (`levelPrefill()`: the second province, kitchens, posture, sourcing), editable | made at build, region and kitchens pre-filled | made at build, nothing pre-filled beyond Stage 2's carry |
| Per-semester plan decisions (`LV_UNLOCK`) | activation S1; weekly menu and delivery timing (batch, who eats last, extra vehicles) together S2, since they are coupled through holding minutes; safety and controls (inspectors, training, SLHS, audit) S3; nothing new S4 | all from S2 | all from S1 |
| Holding meter | bars, λ ticks, per-run annotation, "why" line | bars and λ ticks | bars, λ ticks, expandable S(t) formula and parameters |
| Forecast delta chips | on, plus the "why" line | on, numbers | on, numbers |
| Ledger (pages that touch only some pairs, `PAGE_PAIRS`) | other pairs collapsed to their title | other pairs dimmed | all at full weight |
| Hints (any run's slack < `SLACK_HINT` = 15 min; also Stage 1) | appear automatically | "Show a hint" on click | none |

  **Unlocks are fixed by level:** incidents never open a group early. A Beginner's lever after an S1 incident is the menu and delivery timing, which open in S2 anyway, plus the incident's own responses. `npm test` also plays every trap through the plan page at all three levels and requires identical plans and results, zero engine level reads, and every group opening in its `LV_UNLOCK` semester.
  Sourcing is an irreversible build-time commitment at every level; never make it changeable mid-run. A locked group runs on the value the plan already holds (the posture's defaults, or Stage 2's carry) and shows "Using default — unlocks in Semester N". Decisions outside the table (priorities, budget split) are editable at every level. Stage 2 (Ch4) has no semester staging.
- **Holding meter and forecast:** `meterHtml()` is added before the nav row by `render()` on Stage 1's plan and on Stages 2–3 from the province page through each semester's plan (`meterOn()`). `forecast()` returns only deterministic physical quantities, from `kitchenOps()` (Stage 1: `morningOps()`) on a copy of the current decisions with no events, no incident draws and no seed: per run, minutes held (the engine's hold, not a formula), λ and h of the meal's weakest component, slack = λ − held, S and portions at risk; plus portions at risk a day and cost a day for all planned kitchens (the cost tile says "assumes all planned kitchens open" / "dengan asumsi semua dapur yang direncanakan beroperasi"). Stages 2–3 use one typical kitchen per region on the weekday being edited. Never forecast plate value, incidents, uptake or next year's allocation. It is labelled "Forecast" / "Perkiraan". Forecast delta chips show the change from the previous forecast; all chips (`dchip()`) pulse for ~1.5 s, then settle, with no animation under prefers-reduced-motion.

### Gating map
| | Stage 1 (Ch3) | Stage 2 (Ch4) | Stage 3 (Ch5) |
|---|---|---|---|
| Ledger | Delivered, Exposure (food safety only) | all three pairs | all three pairs |
| Brief facts (`BRIEF_ITEMS`) | clock (the explainer is on the Intro) | unit, who is fed, background (optional) | scale, mission |
| Decisions | run count, meal per run | province (one), radius, size, build/rent, vehicles, sourcing, weekly menu | everything in the full game, opened by level |
| Fixed | 1 vehicle, Teluk Lumba kitchen (30-min leg) | posture "balanced", activation 1, budget split automatic, no events or weather | – |
| Carries forward | run menus → Ch4 week | regency, kitchens, sourcing, menu → Ch5 first region | – |
| Food-cost ceiling | morning average: Σ runs (portions × meal food cost) ≤ fed × Rp10,000 (`FOOD_CEILING`); over it, "Run the morning" is disabled; not scored | – | – |

The Ch3 food-cost ceiling is a modelling decision, not a sourced rule: the sourced Rp10,000 raw-material ceiling is applied as an average per portion across the whole morning (`morningOps()` returns `food`, `foodAvg`, `overCeiling`). It applies in Ch3 only; Ch4–5 keep the existing menu-page handling of the ceiling.

## Local development
- `npm install` once (browser-sync is the only dependency, a devDependency).
- `npm run dev` serves the project root at http://localhost:3000/ with live reload on *.html, *.css, *.js and *.md. `npm run dev:panel` does the same and opens /?dev=1.
- No npm: `python3 -m http.server 8000`, then open http://localhost:8000.
- `npm test` runs the model-invariance test (`tests/invariance.mjs`) in headless Chrome (Node 22+; set `CHROME` if the binary is elsewhere).
- `npm run traps` (`tests/traps.mjs`) plays every Ch5 trap scenario on N salted seeds (`--n`, default 100, at least 50) with common random numbers (the salt replaces the decision vector in the RNG seeds, so a trap and its control share their random streams; `--no-crn` salts each scenario's own seeds instead) and reports means, pattern firing rates, and each control's win rate over its trap (`cheapPatchFixed` vs `cheapPatch`, `variedMenu` vs `dryPack`). A single autoplay is one draw; judge a trap by this report. The salt is dev-only: it lives in the script, never in index.html. Report only; `npm test` is separate.
- Deployment stays a plain static index.html on Vercel: do not add a build or start script, Vite or a framework. The `test` and `traps` scripts are for development only.

## Rules
- Make surgical edits. Never rewrite the whole file.
- Any new player-facing string must be added to I18N with an id translation (EN / ID only; Spanish was removed). Check new work with the full walk (intro, calibration, Stages 1–3) in EN and ID at all three levels. Run the walks one at a time, never in parallel: several headless browsers starting at once can finish booting late, which resets the language mid-walk or leaves a page unrendered.
- Keep the Asphalt design tokens in :root; do not hard-code new colours.
- After changes, check the page still loads and ?dev=1 autoplay runs without errors. The dev panel can jump to the intro, the calibration, the level page or any stage, set the level (a dev tool, not a player override; it restarts the current chapter so the pre-fill applies), and autoplay any stage (`autoplayChapter(n)`). Ch5's trap scenarios must give the same results unless the MBG engine was changed on purpose, and `npm test` must pass. Those single trap draws (dev panel autoplay, `npm test`) are a regression fingerprint only: never read a trap-vs-control lesson from them. Whether a trap still teaches its lesson is judged only by `npm run traps`.
