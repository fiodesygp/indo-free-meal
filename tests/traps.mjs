// Trap comparison: each Chapter 5 trap scenario, and each trap against its control, in expectation.
// Run with `npm run traps` (Node 22+ and Google Chrome; set CHROME to its binary if it is not in the default place).
// Options: --n <seeds> (default 100, at least 50), --no-crn (salt each scenario's own decision-vector seeds instead).
//
// A single autoplay is one draw: its seeds come from the decision vector, so a trap and its control (which differ in
// their decisions) never face the same luck. Here every scenario is played on N salted seeds. By default the salt
// replaces the decision vector in the RNG seeds (common random numbers): for salt i the trap and its control draw the
// same random streams, as far as their different choices consume them alike. The salt lives only in this script
// (it wraps window.decisionVector in the page); the game never sees it. Report only: it exits 1 only on an error.
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
const argv = process.argv.slice(2);
const N = Math.max(50, +(argv[argv.indexOf('--n') + 1] || 0) || 100);
const CRN = !argv.includes('--no-crn');
// Each trap and the control it is meant to lose to; "better" is the control's expected advantage.
const PAIRS = [['cheapPatch', 'cheapPatchFixed'], ['dryPack', 'variedMenu']];

// Runs inside the page.
const IN_PAGE = async (N, CRN, PAIRS) => {
  const M = window.MBG, dv0 = window.decisionVector;
  let salt = null;
  window.decisionVector = s => salt == null ? dv0(s) : CRN ? `crn#${salt}|${s}` : dv0(s) + `#${salt}`;
  M.G.carry.level = 'advanced';
  const play = k => {
    const a = M.autoplay(M.SCENARIOS[k]), R = M.G.results, L = R[R.length - 1].ledger;
    return { score: L.score, delivered: L.delivered, exposure: L.exposure, cost: L.cost, ill: R.reduce((t, c) => t + c.ledger.victims, 0),
      incidents: R.reduce((t, c) => t + c.incidents.length, 0), second: a.secondOrder, traps: a.traps };
  };
  const keys = Object.keys(M.SCENARIOS), runs = {};
  try {
    for (const k of keys) { runs[k] = []; for (let i = 0; i < N; i++) { salt = i; runs[k].push(play(k)); } }
    salt = null;
    const single = Object.fromEntries(keys.map(k => [k, play(k)]));
    const mean = (k, f) => runs[k].reduce((t, r) => t + r[f], 0) / N;
    const scen = keys.map(k => {
      const fire = {};
      for (const r of runs[k]) for (const t of r.traps) fire[t] = (fire[t] || 0) + 1;
      return { k, label: M.SCENARIOS[k].label, score: mean(k, 'score'), delivered: mean(k, 'delivered'), exposure: mean(k, 'exposure'), cost: mean(k, 'cost'),
        ill: mean(k, 'ill'), incidents: mean(k, 'incidents'), second: mean(k, 'second'), fire, single: single[k] };
    });
    const pairs = PAIRS.map(([t, c]) => ({ trap: t, control: c,
      scoreWin: runs[t].filter((r, i) => runs[c][i].score > r.score).length / N,
      illWin: runs[t].filter((r, i) => runs[c][i].ill < r.ill).length / N,
      illTie: runs[t].filter((r, i) => runs[c][i].ill === r.ill).length / N }));
    return { scen, pairs };
  } finally { window.decisionVector = dv0; }
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9500 + Math.floor(Math.random() * 400);
const prof = mkdtempSync(join(tmpdir(), 'mbg-traps-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0, code = 1;
const pending = new Map(), errors = [];
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const f1 = x => x.toFixed(1), f0 = x => Math.round(x).toLocaleString('en'), pc = x => Math.round(100 * x) + '%';
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
  for (let k = 0; k < 50; k++) { const r = await send('Runtime.evaluate', { expression: '!!(window.MBG&&window.decisionVector)', returnByValue: true }); if (r.result.result.value) break; await sleep(200); }
  const r = await send('Runtime.evaluate', { expression: `(${IN_PAGE})(${N},${CRN},${JSON.stringify(PAIRS)})`, awaitPromise: true, returnByValue: true, timeout: 600000 });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  if (errors.length) throw new Error('page error: ' + errors.join('; '));
  const { scen, pairs } = r.result.result.value;
  console.log(`Trap scenarios over ${N} seeds (${CRN ? 'common random numbers' : 'salted decision-vector seeds'}). Means.\n`);
  for (const s of scen) {
    console.log(`${s.k}  (${s.label})`);
    console.log(`  score ${f1(s.score)}  D/E/C ${f1(s.delivered)}/${f1(s.exposure)}/${f1(s.cost)}  ill ${f0(s.ill)}  incidents ${f1(s.incidents)}  second-order ${f1(s.second)}`);
    const fire = Object.entries(s.fire).map(([t, n]) => `${t} ${pc(n / N)}`).join(', ');
    console.log(`  patterns fired: ${fire || 'none'}\n`);
  }
  for (const p of pairs) {
    const t = scen.find(s => s.k === p.trap), c = scen.find(s => s.k === p.control), ok = c.score > t.score;
    console.log(`${p.control} vs ${p.trap}: score ${f1(c.score)} vs ${f1(t.score)} (${ok ? 'control better in expectation' : 'CONTROL NOT BETTER in expectation'}); control scores higher on ${pc(p.scoreWin)} of seeds; ` +
      `ill ${f0(c.ill)} vs ${f0(t.ill)}, control has fewer ill on ${pc(p.illWin)} of seeds${p.illTie ? ` (tied on ${pc(p.illTie)})` : ''}.`);
  }
  console.log('\nSingle draw (regression only): the one autoplay draw per scenario, on its own decision-vector seed. Never judge a trap against its control by it.');
  for (const s of scen) console.log(`  ${s.k}: score ${f1(s.single.score)}, ill ${f0(s.single.ill)}`);
  code = 0;
} catch (e) { console.error('FAIL: ' + e.message); }
finally { try { ws && ws.close(); } catch {} chrome.kill(); await sleep(300); try { rmSync(prof, { recursive: true, force: true }); } catch {} process.exit(code); }
