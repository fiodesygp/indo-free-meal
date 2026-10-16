# MBG: The Four-Hour Race (repo: indo-free-meal)

Single-file educational simulation (index.html) about Indonesia's Makan Bergizi Gratis school-meal supply chain.

## Structure
- Section 1: tunable data tables (PARAMS, REGIONS, MENUS…). Every number is labelled sourced | derived | estimate.
- Section 2: engine (pure functions over state G, no DOM).
- Section 3: UI (VIEWS, A actions, render()).
- Section 4: dev panel, enabled with ?dev=1.
- Translations: I18N, GLOSS_L, INFO_L (en / id / es). Every player-facing string goes through T().

## Rules
- Make surgical edits. Never rewrite the whole file.
- Any new player-facing string must be added to I18N with id and es translations.
- Keep the Asphalt design tokens in :root; do not hard-code new colours.
- After changes, check the page still loads and ?dev=1 autoplay runs without errors.
