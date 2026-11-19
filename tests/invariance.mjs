// Model-invariance test: the display level must never change the simulation.
// Run with `npm test` (Node 22+ and Google Chrome; set CHROME to its binary if it is not in the default place).
//
// 1. Every Chapter 5 trap scenario (a fixed decision vector and event policy) is played at all three levels: the
//    ledger values, the event outcomes and the run seeds must be identical.
// 2. While the engine plays, the level is never read (G.carry.level is a counting getter).
// 3. The forecast never reads the level, never builds the decision-vector seed (decisionVector) or touches
//    Math.random, gives the same result at every level, and leaves the decisions unchanged.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
}[process.platform] || 'google-chrome';

// Runs inside the page. Returns a list of failures (empty = pass) and some counts for the report.
const IN_PAGE = async () => {
  const fail = [], LEVELS = ['beginner', 'intermediate', 'advanced'];
  const M = window.MBG;
  // A counting getter on the level: any read while the engine runs is a failure.
  let reads = 0, value = null;
  const trapLevel = () => { const c = M.G.carry; delete c.level; Object.defineProperty(c, 'level', { configurable: true, enumerable: true, get() { reads++; return value; }, set(v) { value = v; } }); };

  // 1–2. Trap scenarios at every level.
  const runs = {};
  for (const lv of LEVELS) {
    trapLevel(); value = lv; reads = 0;
    runs[lv] = {};
    for (const [k, scn] of Object.entries(M.SCENARIOS)) {
      const r = M.autoplay(scn);
      const G = M.G;
      runs[lv][k] = JSON.stringify({ r, ledger: G.results.map(c => c.ledger), seeds: G.results.map(c => c.seed),
        events: G.eventLog, incidents: G.results.map(c => c.incidents) });
    }
    if (reads) fail.push(`engine read the level ${reads} time(s) while playing the scenarios at "${lv}"`);
  }
  for (const k of Object.keys(M.SCENARIOS)) for (const lv of LEVELS.slice(1))
    if (runs[lv][k] !== runs.beginner[k]) fail.push(`scenario "${k}": results differ between beginner and ${lv}`);

  // 3. Forecast: Stage 3 set-up and a semester plan, and Stage 1's plan.
  const spy = { dv: 0, rnd: 0 };
  const dv0 = window.decisionVector, rnd0 = Math.random;
  const forecasts = {};
  for (const lv of LEVELS) {
    trapLevel(); value = lv;
    M.startChapter(5);  // Stage 3 with this level's pre-fill, then the same decisions for every level
    const G = M.G;
    Object.assign(G.dec, JSON.parse(JSON.stringify({ posture: 'balanced', regions: ['JT', 'KB'], regency: { JT: 0, KB: 0 }, radius: { JT: 6, KB: 4.5 },
      siting: { JT: { target: 2500, tenure: 'build', fleet: 2 }, KB: { target: 3000, tenure: 'rent', fleet: 1 } }, sourcing: { arch: 'mixed', rails: false, receipts: false },
      menu: [{ m: 'M2', a: 'cutFruit' }, { m: 'M1', a: 'none' }, { m: 'M3', a: 'none' }, { m: 'M5', a: 'sambal' }, { m: 'M7', a: 'none' }], delivery: { batch: 'single', lastRun: 'farthest' } })));
    const out = [];
    window.decisionVector = (...a) => { spy.dv++; return dv0(...a); };
    Math.random = () => { spy.rnd++; return rnd0(); };
    try {
      for (const day of [0, 3]) {
        G.ui.activeRun = day; const before = JSON.stringify(G.dec);
        reads = 0; out.push(window.forecast());
        if (reads) fail.push(`forecast read the level at "${lv}"`);
        if (JSON.stringify(G.dec) !== before) fail.push(`forecast changed the decisions at "${lv}"`);
      }
      M.startChapter(3); reads = 0; out.push(window.forecast());
      if (reads) fail.push(`Stage 1 forecast read the level at "${lv}"`);
    } finally { window.decisionVector = dv0; Math.random = rnd0; }
    forecasts[lv] = JSON.stringify(out);
  }
  if (spy.dv) fail.push(`forecast built the decision-vector seed ${spy.dv} time(s)`);
  if (spy.rnd) fail.push(`forecast called Math.random ${spy.rnd} time(s)`);
  for (const lv of LEVELS.slice(1)) if (forecasts[lv] !== forecasts.beginner) fail.push(`forecast differs between beginner and ${lv}`);
  if (!JSON.parse(forecasts.beginner).every(f => f && f.rows.length)) fail.push('forecast returned no runs');
  return { fail, scenarios: Object.keys(M.SCENARIOS).length, forecasts: JSON.parse(forecasts.beginner).length };
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9500 + Math.floor(Math.random() * 400);
const prof = mkdtempSync(join(tmpdir(), 'mbg-test-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0, code = 1;
const pending = new Map(), errors = [];
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
try {
  let page;
  for (let k = 0; k < 75 && !page; k++) { try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {} if (!page) await sleep(200); }
  if (!page) throw new Error(`could not start Chrome at ${CHROME} (set CHROME to its binary)`);
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: pathToFileURL(join(ROOT, 'index.html')).href });
  for (let k = 0; k < 50; k++) { const r = await send('Runtime.evaluate', { expression: '!!(window.MBG&&window.forecast)', returnByValue: true }); if (r.result.result.value) break; await sleep(200); }
  const r = await send('Runtime.evaluate', { expression: `(${IN_PAGE})()`, awaitPromise: true, returnByValue: true, timeout: 240000 });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  const { fail, scenarios, forecasts } = r.result.result.value;
  fail.push(...errors.map(e => 'page error: ' + e));
  if (fail.length) { console.error('FAIL\n- ' + fail.join('\n- ')); }
  else { console.log(`PASS: ${scenarios} scenarios identical at all three levels with no level reads; ${forecasts} forecasts per level identical, no level reads, no seed, no Math.random, decisions unchanged.`); code = 0; }
} catch (e) { console.error('FAIL: ' + e.message); }
finally { try { ws && ws.close(); } catch {} chrome.kill(); await sleep(300); try { rmSync(prof, { recursive: true, force: true }); } catch {} process.exit(code); }
