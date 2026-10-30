# indo-free-meal

## Local development

1. Install once: `npm install`
2. Run the simulation: `npm run dev` (opens http://localhost:3000/ and reloads when a file changes)
3. Run it with the dev panel: `npm run dev:panel` (opens http://localhost:3000/?dev=1)

No npm? From the project folder, run `python3 -m http.server 8000`, then open http://localhost:8000 (add `?dev=1` for the dev panel). This server doesn't reload automatically.

The site deploys as a plain static `index.html`; npm is only for the local dev server.
