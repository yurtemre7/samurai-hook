import { createAssets } from './core/assets';
import { createAudio } from './core/audio';
import { loadKanjiFont } from './core/fonts';
import { createPerf } from './core/perf';
import { createGameState } from './game/state';
import { createInput } from './input/input';
import { createTouchControls, touchEnabled } from './input/touch';
import { demoStart, music, sounds, sprites, voice } from './manifest';
import { createCutsceneScene } from './scenes/cutscene';
import { createFightScene } from './scenes/fight';
import { createOceanScene } from './scenes/ocean';
import { createResultScene } from './scenes/result';
import { createShopScene } from './scenes/shop';
import type { Game, Scene, SceneFactory, SceneId, SceneParams } from './types';

const WIDTH = 960;
const HEIGHT = 540;
const STEP = 1 / 60;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function fit(): void {
  const vv = window.visualViewport;
  const s = Math.min((vv?.width ?? window.innerWidth) / WIDTH, (vv?.height ?? window.innerHeight) / HEIGHT);
  canvas.style.width = `${Math.floor(WIDTH * s)}px`;
  canvas.style.height = `${Math.floor(HEIGHT * s)}px`;
}
window.addEventListener('resize', fit);
window.visualViewport?.addEventListener('resize', fit);
fit();

const factories: { [K in SceneId]: SceneFactory<K> } = {
  ocean: createOceanScene,
  cutscene: createCutsceneScene,
  fight: createFightScene,
  result: createResultScene,
  shop: createShopScene,
};

let scene: Scene | null = null;
let time = 0;

const input = createInput();
// Touch overlay: phones (coarse pointer) or ?touch=1. Desktop is untouched.
const touch = touchEnabled(location.search, window.matchMedia('(pointer: coarse)').matches)
  ? createTouchControls(input)
  : null;

const game: Game = {
  width: WIDTH,
  height: HEIGHT,
  get time() { return time; },
  input,
  assets: createAssets(sprites),
  audio: createAudio(sounds, music, voice),
  state: createGameState(window.localStorage),
  go<K extends SceneId>(id: K, params: SceneParams[K]) {
    scene?.exit?.();
    scene = (factories[id] as SceneFactory<K>)(game, params);
    scene.enter?.();
  },
};

// ?debug=perf readout (no-op otherwise): fps, worst frame, touch-to-game delay, build.
const perf = createPerf();
window.addEventListener('pointerdown', (e) => perf.touched(e.timeStamp || performance.now()), true);

// Browsers block audio until the first user gesture.
for (const ev of ['keydown', 'pointerdown', 'touchend', 'gamepadconnected'] as const) {
  window.addEventListener(ev, () => game.audio.unlock());
}

/** Dev shortcut: ?scene=fight&fish=shark&tier=0 jumps straight to a scene. */
function start(): void {
  const q = new URLSearchParams(location.search);
  if (q.get('start') === 'demo') game.state.loadPreset(demoStart);
  if (q.get('start') === 'fresh') game.state.reset();
  const id = q.get('scene') as SceneId | null;
  const f = game.state.makeFish(q.get('fish') ?? 'sardine', Number(q.get('tier') ?? 0));
  if (id === 'fight' || id === 'cutscene') game.go(id, { fish: f });
  else if (id === 'result') game.go('result', { fish: f, outcome: (q.get('outcome') as 'win') ?? 'win', goldEarned: f.gold });
  else if (id === 'shop') game.go('shop', undefined);
  else game.go('ocean', undefined);
}

let last = performance.now();
let acc = 0;
function frame(now: number): void {
  perf.frame(now);
  if (touch?.blocked()) {
    // Portrait on a phone: no steps, no input. Keep the clock moving so rotating back does not jump.
    last = now;
    acc = 0;
    requestAnimationFrame(frame);
    return;
  }
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    game.input.update();
    if (game.input.anyPressed() || game.input.tapped() || game.input.dragDX() !== 0) perf.consumed(performance.now());
    if (game.input.anyPressed()) game.audio.unlock();
    scene?.update(STEP);
    time += STEP;
    acc -= STEP;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  scene?.render(ctx);
  requestAnimationFrame(frame);
}

Promise.all([game.assets.load(), loadKanjiFont()]).then(() => {
  start();
  requestAnimationFrame(frame);
});

// Demo shortcuts: F2 = start with progress (manifest `demoStart`), F4 = wipe the save.
window.addEventListener('keydown', (e) => {
  if (e.code === 'F2') { e.preventDefault(); game.state.loadPreset(demoStart); game.audio.play('buy'); game.go('ocean', undefined); }
  if (e.code === 'F4') { e.preventDefault(); game.state.reset(); game.audio.play('uiDeny'); game.go('ocean', undefined); }
});

// Handy in the browser console while tuning.
(window as unknown as { game: Game }).game = game;
