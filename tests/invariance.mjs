// Model-invariance test: the display level must never change the simulation.
// Run with `npm test` (Node 22+ and Google Chrome; set CHROME to its binary if it is not in the default place).
//
// 1. Every Chapter 5 trap scenario (a fixed decision vector and event policy) is played at all three levels: the
//    ledger values, the event outcomes and the run seeds must be identical.
// 2. While the engine plays, the level is never read (G.carry.level is a counting getter).
// 3. The forecast never reads the level, never builds the decision-vector seed (decisionVector) or touches
//    Math.random, gives the same result at every level, and leaves the decisions unchanged.
// 4. The same scenarios played through the semester plan page with the level's gating: each decision group opens
//    in its level's fixed semester whatever the incidents, rendering never changes the plan, the engine never reads the level,
//    and the plans handed to the engine and the results are identical at every level.
// 6. Meals forecast: in every trap semester (at every level, through the plan page), the Meals cost the budget page
//    forecasts (budgetNeeds) equals the engine's planned Meals cost at full service (ctx.plannedCost), and equals the
//    Meals cost actually charged in every semester nothing disrupted (full funding, no lost or shelf-pack days, no price
//    or menu events, no flooded kitchens, no reserve shortfall). Disruptions are charged on top of the plan by design.
// 5. Reproducibility: every trap scenario gives the identical run cold (a fresh page per trap) and after two different
//    warm-ups in one page (the traps on 50 salted seeds; Stage 1 and Stage 2 autoplay), so the same decisions always
//    give the same run, however long the page has been running.
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

  // 4. The same scenarios played through the semester plan page, as a player would: the page renders each plan at the
  //    level (the gating reads it), then the engine runs it. The page fills in
  //    the default budget split, as it does for every player, so the plan it hands the engine must be identical at
  //    every level; the engine calls must read the level zero times; and the results must be identical at every level.
  //    Each group must open in the fixed semester LV_UNLOCK gives, whatever incidents happened (no early unlock).
  const ui = {}, opened = {}, plans = {}, mealChecks = { planned: 0, calm: 0 };
  for (const lv of LEVELS) {
    trapLevel(); value = lv; ui[lv] = {}; opened[lv] = {}; plans[lv] = {};
    for (const [k, scn] of Object.entries(M.SCENARIOS)) {
      G.chapter = 5; resetGame(); setChapter(5); G.dec = Object.assign(clone(BASE_DEC), clone(scn.dec || {})); initWorld();
      const open = [];
      for (let y = 1; y <= NP(); y++) {
        G.phase = YEAR_PHASE0 + y; G.ctx = null;
        G.draft = Object.assign(defaultPlan(y), scn.plan ? clone(scn.plan(y)) : {});
        render();  // the plan page: reads the level
        plans[lv][k + y] = JSON.stringify(G.draft);
        if (lv !== 'beginner' && plans[lv][k + y] !== plans.beginner[k + y]) fail.push(`scenario "${k}": the Semester ${y} plan page left a different plan at "${lv}" than at beginner`);
        open.push(unlockAt('safety') <= y ? 1 : 0);
        if (y > 1 && unlockAt('safety') === y && !document.querySelector('.unlockcard')) fail.push(`scenario "${k}" at "${lv}": safety opened in Semester ${y} without its card`);
        for (const g of ['activation', 'menu', 'delivery', 'safety']) if (unlockAt(g) !== LV_UNLOCK[lv][g]) fail.push(`scenario "${k}" at "${lv}": ${g} opens in Semester ${unlockAt(g)}, not the fixed Semester ${LV_UNLOCK[lv][g]}`);
        const forecastMeals = budgetNeeds(G.draft, y).meals;
        reads = 0;
        G.plans[y - 1] = clone(G.draft); G.draft = null; beginYear(y, G.plans[y - 1]);
        // 6. The Meals forecast equals what the engine plans to charge, and what it charges when nothing disrupts service.
        const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
        if (!near(forecastMeals, G.ctx.plannedCost)) fail.push(`scenario "${k}" at "${lv}", Semester ${y}: Meals forecast ${Math.round(forecastMeals)} ≠ planned ${Math.round(G.ctx.plannedCost)}`);
        mealChecks.planned++;
        while (G.ctx.stage !== 'results') { const ev = G.ctx.queue[0]; const opts = EVENT_TEXT[ev.type](ev).opts.map(o => o[0]); const want = (scn.choose || {})[ev.type]; resolveEvent(opts.includes(want) ? want : opts[0]); }
        if (reads) fail.push(`scenario "${k}" at "${lv}": the engine read the level ${reads} time(s) in Semester ${y}`);
        { const c = G.ctx, none = o => !Object.values(o || {}).some(v => v);
          const calm = c.fundFrac >= 1 && none(c.lostDays) && none(c.shelfDays) && none(c.costMult) && !c.priceAbsorb && !c.menuSwap && !(c.reserveShort > 0) && !(c.weather || []).some(e => e.kids.length);
          if (calm) { mealChecks.calm++; const charged = c.foodSpend + c.opsSpend + c.eventCost;
            if (!near(forecastMeals, charged)) fail.push(`scenario "${k}" at "${lv}", Semester ${y} (no disruption): Meals forecast ${Math.round(forecastMeals)} ≠ charged ${Math.round(charged)}`); } }
      }
      opened[lv][k] = open.join('');
      ui[lv][k] = JSON.stringify({ ledger: G.results.map(c => c.ledger), seeds: G.results.map(c => c.seed), events: G.eventLog, incidents: G.results.map(c => c.incidents) });
    }
  }
  for (const k of Object.keys(M.SCENARIOS)) for (const lv of LEVELS.slice(1))
    if (ui[lv][k] !== ui.beginner[k]) fail.push(`scenario "${k}" through the plan page: results differ between beginner and ${lv}`);
  return { fail, scenarios: Object.keys(M.SCENARIOS).length, forecasts: JSON.parse(forecasts.beginner).length, opened: opened.beginner, mealChecks };
};

// 5. Fingerprint of one trap's run, and the warm-ups. Run inside the page.
//    Each trap is fingerprinted on its own seed and on 20 salted seeds, so the rarer paths (floods, redirects) are hit.
const FP = `(k=>{const M=window.MBG,dv0=window.decisionVector,out=[];M.G.carry.level='advanced';
  try{for(let i=-1;i<20;i++){window.decisionVector=i<0?dv0:s=>dv0(s)+'#fp'+i;const r=M.autoplay(M.SCENARIOS[k]),G=M.G;
    out.push(JSON.stringify({r,ledger:G.results.map(c=>c.ledger),seeds:G.results.map(c=>c.seed),events:G.eventLog,incidents:G.results.map(c=>c.incidents),
      weather:G.results.map(c=>c.weather),chains:G.world.chains}));}}finally{window.decisionVector=dv0;}
  return out;})`;
const WARM = {
  'after the traps on 50 salted seeds': `(()=>{const M=window.MBG,dv0=window.decisionVector;try{for(const k of Object.keys(M.SCENARIOS))for(let i=0;i<50;i++){window.decisionVector=s=>dv0(s)+'#warm'+i;M.autoplay(M.SCENARIOS[k]);}}finally{window.decisionVector=dv0;}})()`,
  'after Stage 1 and Stage 2 autoplay': `(()=>{const M=window.MBG;M.autoplayChapter(3);M.autoplayChapter(4);M.autoplayChapter(3);M.autoplayChapter(4);})()`,
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
  const load = async () => {
    await send('Page.navigate', { url: pathToFileURL(join(ROOT, 'index.html')).href });
    for (let k = 0; k < 50; k++) { const r = await send('Runtime.evaluate', { expression: '!!(window.MBG&&window.forecast)&&document.readyState==="complete"', returnByValue: true }); if (r.result.result.value) break; await sleep(200); }
  };
  const evalPage = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 240000 });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  await load();
  const r = await send('Runtime.evaluate', { expression: `(${IN_PAGE})()`, awaitPromise: true, returnByValue: true, timeout: 240000 });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  const { fail, scenarios, forecasts, opened, mealChecks } = r.result.result.value;
  // 5. Reproducibility across warm-ups.
  const keys = await evalPage('Object.keys(window.MBG.SCENARIOS)'), cold = {};
  for (const k of keys) { await load(); cold[k] = await evalPage(`${FP}(${JSON.stringify(k)})`); }
  for (const [label, warm] of Object.entries(WARM)) {
    await load(); await evalPage(warm);
    for (const k of keys) { const got = await evalPage(`${FP}(${JSON.stringify(k)})`), bad = got.map((g, i) => g !== cold[k][i] ? (i ? 'salt ' + (i - 1) : 'its own seed') : null).filter(Boolean);
      if (bad.length) fail.push(`scenario "${k}" gives a different run ${label} than cold (${bad.length} of ${got.length} seeds: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''})`); }
  }
  fail.push(...errors.map(e => 'page error: ' + e));
  if (fail.length) { console.error('FAIL\n- ' + fail.join('\n- ')); }
  else { console.log(`PASS: ${scenarios} scenarios identical at all three levels with no level reads; ${forecasts} forecasts per level identical, no level reads, no seed, no Math.random, decisions unchanged; played through the plan page at all three levels with the level gating on: identical results, no engine level reads, unlocks fixed by level whatever the incidents (beginner safety open by semester: ${Object.entries(opened).map(([k, v]) => k + ' ' + v).join(', ')}); every trap gives the identical run cold and after ${Object.keys(WARM).length} warm-ups; the Meals forecast equals the engine's planned Meals cost in all ${mealChecks.planned} trap semesters, and the charged cost in the ${mealChecks.calm} with no disruption.`); code = 0; }
} catch (e) { console.error('FAIL: ' + e.message); }
finally { try { ws && ws.close(); } catch {} chrome.kill(); await sleep(300); try { rmSync(prof, { recursive: true, force: true }); } catch {} process.exit(code); }
