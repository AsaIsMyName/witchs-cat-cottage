// `npm run shots`: takes fixed screenshots of the game for checking visuals before a playtest.
// Starts its own Vite dev server on a free port, drives headless Edge over the DevTools protocol
// (Node's global WebSocket, no extra dependencies), seeds each scene's save in localStorage, and
// writes PNGs to shots/ (gitignored, overwritten each run). Uses the dev-only `window.__shots` hook
// from src/scenes/dev-shots.ts. Works on this PC: the Edge path is hard-coded.

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "shots");
const PROFILE = join(tmpdir(), "wcc-shots-edge");
const SAVE_KEY = "witchs-cat-cottage/save";
const WIDTH = 960;
const HEIGHT = 540;
const TIMEOUT_MS = 15000;

// Seed rooms (save format v3). The game silently starts fresh if a seed breaks the room rules,
// so every shot that uses an item checks the item is there.
const EMPTY = {
  placements: [],
  inventory: { frame: 1, "moon-chart": 1, shelf: 2, clock: 1, table: 1, stool: 1, rug: 1, cauldron: 1, candle: 2, potion: 2 },
  nextUid: 1,
};
const BUSY = {
  placements: [
    { uid: "p1", itemId: "rug", layer: "rug", col: 3, row: 4 },
    { uid: "p2", itemId: "table", layer: "floor", col: 4, row: 4 },
    { uid: "p3", itemId: "candle", layer: "surface", hostUid: "p2", slot: 0 },
    { uid: "p4", itemId: "cauldron", layer: "floor", col: 10, row: 4 },
    { uid: "p5", itemId: "stool", layer: "floor", col: 11, row: 4 },
    { uid: "p6", itemId: "shelf", layer: "wall", col: 2, row: 0 },
    { uid: "p7", itemId: "potion", layer: "surface", hostUid: "p6", slot: 0 },
    { uid: "p8", itemId: "frame", layer: "wall", col: 6, row: 0 },
    { uid: "p9", itemId: "clock", layer: "wall", col: 9, row: 0 },
    { uid: "p10", itemId: "moon-chart", layer: "wall", col: 12, row: 1 },
  ],
  inventory: { shelf: 1, candle: 1, potion: 1 },
  nextUid: 11,
};

/**
 * Each shot loads its seed fresh, then runs `setup(page)`. Drags are never released, so the next
 * shot's reload throws them away.
 */
const SHOTS = [
  { file: "01-empty-room.png", seed: EMPTY, setup: (p) => p.pinCat("down", 7, 6) },
  { file: "02-busy-room.png", seed: BUSY, setup: (p) => p.pinCat("down", 7, 6) },
  { file: "03-cat-up.png", seed: EMPTY, setup: (p) => p.pinCat("up", 7, 6) },
  { file: "04-cat-down.png", seed: EMPTY, setup: (p) => p.pinCat("down", 7, 6) },
  { file: "05-cat-left.png", seed: EMPTY, setup: (p) => p.pinCat("left", 7, 6) },
  { file: "06-cat-right.png", seed: EMPTY, setup: (p) => p.pinCat("right", 7, 6) },
  // Free floor tile: green.
  { file: "07-drag-green.png", seed: BUSY, setup: (p) => p.drag(p.placed("p5"), p.tile("floor", 13, 7)) },
  // The table over the cauldron and the stool (two items): red.
  { file: "08-drag-red.png", seed: BUSY, setup: (p) => p.drag(p.placed("p2"), p.tile("floor", 10, 4)) },
  // The frame onto the clock: blue swap.
  { file: "09-drag-blue.png", seed: BUSY, setup: (p) => p.drag(p.placed("p8"), p.placed("p9")) },
  // A potion from the tray onto the candle: amber replace.
  { file: "10-drag-amber.png", seed: BUSY, setup: (p) => p.drag(p.tray("potion"), p.placed("p3")) },
  // Behind the table's right end, its head past the edge: the table hides the rest of the cat.
  { file: "11-cat-behind-table.png", seed: BUSY, setup: (p) => p.pinCat("right", 5.75, 3) },
  // The mouse resting on the table, no button pressed: its name shows above it.
  { file: "12-hover-name.png", seed: BUSY, setup: (p) => p.hover(p.placed("p2")) },
];

let vite;
let edge;
let ws;

try {
  mkdirSync(OUT, { recursive: true });
  const port = await freePort();
  vite = await createServer({
    root: ROOT,
    logLevel: "warn",
    server: { port, strictPort: true, host: "127.0.0.1", hmr: false },
  });
  await vite.listen();
  const url = `http://127.0.0.1:${port}/`;

  const cdp = await launchEdge();
  const page = makePage(cdp);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });

  // Warm-up load: Vite may optimize dependencies and reload the page on the first visit.
  await page.load(url, EMPTY);
  page.errors.length = 0;

  for (const shot of SHOTS) {
    try {
      await page.load(url, shot.seed);
      await shot.setup(page);
      await page.waitSettled();
      if (page.errors.length > 0) throw new Error(`page error: ${page.errors.join(" | ")}`);
      const { data } = await cdp.send("Page.captureScreenshot", {
        format: "png",
        clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
      });
      writeFileSync(join(OUT, shot.file), Buffer.from(data, "base64"));
      console.log(`shots/${shot.file}`);
    } catch (err) {
      throw new Error(`${shot.file}: ${err.message}`, { cause: err });
    }
  }
  console.log(`${SHOTS.length} shots written to ${OUT}`);
} catch (err) {
  console.error(`shots failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  ws?.close();
  edge?.kill();
  killProfileEdge();
  await vite?.close();
}

function freePort() {
  return new Promise((done, fail) => {
    const server = createNetServer();
    server.on("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });
}

/** Starts headless Edge on its own scratch profile and connects to its page over the DevTools protocol. */
async function launchEdge() {
  killProfileEdge(); // anything left from an earlier run that was cut short
  edge = spawn(EDGE, [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${PROFILE}`,
    "--no-first-run",
    "--no-default-browser-check",
    `--window-size=${WIDTH},${HEIGHT}`,
    "about:blank",
  ]);
  const debugPort = await new Promise((done, fail) => {
    let log = "";
    const timer = setTimeout(() => fail(new Error(`Edge didn't start: ${log}`)), TIMEOUT_MS);
    edge.on("error", fail);
    edge.stderr.on("data", (chunk) => {
      log += chunk;
      const match = /DevTools listening on ws:\/\/[^:]+:(\d+)\//.exec(log);
      if (match) {
        clearTimeout(timer);
        done(match[1]);
      }
    });
  });
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const target = targets.find((t) => t.type === "page");
  if (!target) throw new Error("Edge has no page to drive");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, fail) => {
    ws.onopen = done;
    ws.onerror = () => fail(new Error("couldn't connect to Edge"));
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id !== undefined) {
      const call = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) call.fail(new Error(`${call.method}: ${msg.error.message}`));
      else call.done(msg.result);
    } else {
      for (const listener of listeners) listener(msg.method, msg.params);
    }
  };
  return {
    send: (method, params = {}) =>
      new Promise((done, fail) => {
        const id = nextId++;
        pending.set(id, { method, done, fail });
        ws.send(JSON.stringify({ id, method, params }));
      }),
    on: (listener) => listeners.push(listener),
  };
}

/** Stops only the Edge processes using this script's scratch profile, never Asa's own Edge. */
function killProfileEdge() {
  const filter = PROFILE.replace(/'/g, "''");
  spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${filter}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ],
    { stdio: "ignore" },
  );
}

/** Page helpers the shots use. Points are in game pixels, which the viewport maps 1:1 to the page. */
function makePage(cdp) {
  const errors = [];
  cdp.on((method, params) => {
    if (method === "Runtime.exceptionThrown")
      errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    if (method === "Runtime.consoleAPICalled" && params.type === "error")
      errors.push(params.args.map((a) => a.value ?? a.description).join(" "));
  });
  let seedScript;

  async function evaluate(expression) {
    const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  }

  async function waitFor(expression, what) {
    const end = Date.now() + TIMEOUT_MS;
    while (Date.now() < end) {
      if (await evaluate(expression)) return;
      await new Promise((done) => setTimeout(done, 50));
    }
    throw new Error(`timed out waiting for ${what}`);
  }

  const frames = (n) =>
    evaluate(
      `new Promise((done) => { let n = ${n}; const step = () => (--n <= 0 ? done() : requestAnimationFrame(step)); requestAnimationFrame(step); })`,
    );

  /** A mouse event with the left button held (`held` false: no button, for hovering). */
  const mouse = (type, x, y, held = true) =>
    cdp.send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: held ? "left" : "none",
      buttons: held && type !== "mouseReleased" ? 1 : 0,
      clickCount: held ? 1 : 0,
    });

  const page = {
    errors,
    async load(url, seed) {
      if (seedScript) await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: seedScript });
      const save = JSON.stringify({ version: 3, rooms: { bedroom: seed } });
      ({ identifier: seedScript } = await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(save)});`,
      }));
      await cdp.send("Page.navigate", { url });
      await waitFor("document.readyState === 'complete' && window.__shots !== undefined", "the Decorate scene");
      await frames(2);
      // The seed must have loaded: with a rejected seed the room starts fresh and empty.
      const placed = await evaluate(
        `${JSON.stringify(seed.placements.map((p) => p.uid))}.every((uid) => window.__shots.placed(uid))`,
      );
      if (!placed) throw new Error("the seed room was rejected (the game started fresh)");
      // Every shot pins the cat; this default keeps drag shots still too.
      await page.pinCat("down", 14, 8);
    },
    pinCat: (facing, col, row) => evaluate(`window.__shots.pinCat(${JSON.stringify(facing)}, ${col}, ${row})`),
    placed: (uid) => ({ uid, query: `window.__shots.placed(${JSON.stringify(uid)})` }),
    tray: (itemId) => ({ uid: `tray ${itemId}`, query: `window.__shots.tray(${JSON.stringify(itemId)})` }),
    tile: (layer, col, row) => ({ uid: `${layer} tile ${col},${row}`, query: `window.__shots.tile("${layer}", ${col}, ${row})` }),
    /**
     * Picks `from` up by its front face and moves it so its footprint lands on `to`'s, without letting
     * go. It stops a few pixels off the spot (still snapping there), so the drop preview shows beside it.
     */
    async drag(from, to) {
      const a = await evaluate(from.query);
      const b = await evaluate(to.query);
      if (!a) throw new Error(`no ${from.uid} to drag`);
      if (!b) throw new Error(`no ${to.uid} to drop on`);
      await mouse("mouseMoved", a.grabX, a.grabY);
      await mouse("mousePressed", a.grabX, a.grabY);
      await frames(2);
      // The drag starts once the pointer passes the 4 px threshold, and its grab offset is taken
      // there, so step just past it first and carry that step to the end point.
      const start = { x: a.grabX + 5, y: a.grabY };
      await mouse("mouseMoved", start.x, start.y);
      await frames(1);
      const end = { x: start.x + b.x - a.x - 9, y: start.y + b.y - a.y + 7 };
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        await mouse("mouseMoved", start.x + ((end.x - start.x) * i) / steps, start.y + ((end.y - start.y) * i) / steps);
        await frames(1);
      }
    },
    /** Rests the mouse on `target`'s front face without pressing. */
    async hover(target) {
      const a = await evaluate(target.query);
      if (!a) throw new Error(`no ${target.uid} to hover`);
      await mouse("mouseMoved", a.grabX, a.grabY, false);
      await frames(2);
    },
    async waitSettled() {
      await waitFor("window.__shots.settled()", "effects to finish");
      await frames(2);
    },
  };
  return page;
}
