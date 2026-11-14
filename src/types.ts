// Shared contracts. Every module builds against these.
// Changes here go through the orchestrator (see HANDOVER.md).

// ---------- Input ----------

export type Action =
  | 'left' | 'right' | 'up' | 'down'
  | 'confirm' // drop hook, accept, skip cutscene
  | 'quick'   // quick slash
  | 'heavy'   // heavy slash
  | 'defend'  // hold = block, tap + direction = dash-dodge
  | 'shop';   // open / close the shop at the surface

export type Device = 'keyboard' | 'gamepad';

export interface Input {
  /** Call exactly once per fixed update step, before the scene updates. */
  update(): void;
  /** True while the action is held down. */
  held(a: Action): boolean;
  /** True only on the step the action went down. */
  pressed(a: Action): boolean;
  /** Horizontal movement, -1..1. Analogue on a stick, -1/0/1 on keys or d-pad. */
  moveX(): number;
  /** Vertical movement, -1 (up) .. 1 (down). */
  moveY(): number;
  /** True on a step where any mapped action went down. */
  anyPressed(): boolean;
  /** The device used most recently. Prompts follow this. */
  readonly device: Device;
  /** Short glyph text for an action on the current device, e.g. "J" or "X". */
  glyph(a: Action): string;
}

export interface Prompt {
  action: Action | 'move';
  label: string;
}

// ---------- Assets and audio ----------

export type PlaceholderShape = 'fish' | 'samurai' | 'boat' | 'hook' | 'nigiri' | 'box';

export interface SpriteDef {
  /** Path under /public (e.g. "assets/fish/sardine.png"), or null to use the placeholder. */
  src: string | null;
  /** Number of frames in a horizontal strip. Default 1. */
  frames?: number;
  /** Animation speed for strips. Default 8. */
  fps?: number;
  /** Size to draw one frame at, in game pixels. */
  w: number;
  h: number;
  /** Which way the source art faces. Unflipped drawing always faces right. Default 'right'. */
  facing?: 'left' | 'right';
  placeholder: { shape: PlaceholderShape; color: string; label?: string };
}

export interface DrawOpts {
  flipX?: boolean;   // true = face left
  scale?: number;
  alpha?: number;
  rotation?: number; // radians
  time?: number;     // seconds, selects the animation frame
  tint?: string;     // flash colour drawn over the sprite (e.g. hit flash)
}

export interface Assets {
  load(): Promise<void>;
  /** True if the sprite has a loaded image (not a placeholder). */
  has(id: string): boolean;
  /** Draws the sprite centred on (x, y). Draws the placeholder if the image is missing. */
  draw(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, opts?: DrawOpts): void;
}

export interface SoundDef {
  /** Path under /public, or null to use the synthesised fallback blip. */
  src: string | null;
  volume?: number;
  fallback: { freq: number; dur: number; wave?: OscillatorType };
}

export interface AudioSys {
  /** Call on the first user input; browsers block audio before that. */
  unlock(): void;
  play(id: string): void;
  music(id: string | null): void;
  /** Announcer line. Plays the recorded clip for `clip` when the manifest has
   *  one, else speaks `text` with browser speech synthesis (silent if
   *  unsupported). Announcer lines never overlap. */
  announce(text: string, clip?: import('./core/announcer').AnnounceRequest): void;
}

// ---------- Fish ----------

export type FishCategory = 'slippery' | 'biter';
export type Gimmick = 'none' | 'puff' | 'dark' | 'ink';

export interface FishDef {
  id: string;
  name: string;
  /** Shown on the health bar, e.g. "3RD DAN". */
  title: string;
  category: FishCategory;
  sprite: string;
  /** Depth band in metres (tier 0). */
  depthMin: number;
  depthMax: number;
  hp: number;
  /** Round timer in seconds. */
  timer: number;
  gold: number;
  /** Ocean swim speed, px/s. */
  swimSpeed: number;
  /** Fight body radius in px (hitbox and draw scale). */
  size: number;
  move: {
    speed: number;    // px/s in the fight
    keepAway: number; // distance from the samurai it likes to hold
    restless: number; // 0..1, how often it repositions
  };
  slip: {
    /** Seconds the fish stays vulnerable (cannot slip) after a slip. */
    recovery: number;
    /** How far it darts when it slips, px. */
    dart: number;
  };
  attack?: {
    damage: number;
    tell: number;     // wind-up seconds, shown to the player
    cooldown: number; // seconds between attacks
    reach: number;    // px
  };
  gimmick: Gimmick;
  taunts: string[];
}

/** A concrete fish on the hook: a FishDef scaled by its depth tier. */
export interface FishInstance {
  def: FishDef;
  tier: number;
  /** Display name including any tier prefix, upper case. */
  name: string;
  maxHp: number;
  /** Gold before the player's gold bonus. */
  gold: number;
}

// ---------- Game state ----------

export type UpgradeId = 'damage' | 'depth' | 'gold';

export interface UpgradeDef {
  id: UpgradeId;
  label: string;
  baseCost: number;
  growth: number;
  /** Effect added per level (meaning depends on the track). */
  perLevel: number;
  /** Funny names by level; the last one repeats with a "+N" suffix. */
  names: string[];
}

export interface UpgradeInfo {
  id: UpgradeId;
  label: string;
  level: number;
  cost: number;
  affordable: boolean;
  /** Name of the current level, e.g. "Rusty Katana". */
  name: string;
  /** e.g. "Damage x1.25 -> x1.50". */
  effect: string;
}

export interface SamuraiStats {
  maxHp: number;
  quickDamage: number;
  heavyDamage: number;
}

export interface GameState {
  readonly gold: number;
  /** Number of fights started; used for "ROUND N". */
  readonly round: number;
  readonly maxDepth: number;
  readonly samurai: SamuraiStats;
  upgrades(): UpgradeInfo[];
  buy(id: UpgradeId): boolean;
  /** A random fish living at this depth, or null if none does. rng returns 0..1. */
  pickFish(depth: number, rng?: () => number): FishInstance | null;
  makeFish(fishId: string, tier: number): FishInstance;
  /** Increments and returns the round counter. Call when a fight begins. */
  nextRound(): number;
  /** Adds the fish's gold (with bonus) and saves. Returns the amount earned. */
  sell(fish: FishInstance): number;
  reset(): void;
  /** Replaces the save with a preset: gold and upgrade levels (demo shortcut). */
  loadPreset(preset: { gold: number; levels: Record<UpgradeId, number> }): void;
}

// ---------- Fight ----------

export type FightOutcome = 'win' | 'timeout' | 'ko';

/** One step of player intent for the fight simulation. */
export interface FightInput {
  moveX: number;         // -1..1
  quick: boolean;        // pressed this step
  heavy: boolean;        // pressed this step
  defendHeld: boolean;
  defendPressed: boolean;
}

// ---------- Scenes ----------

export interface Scene {
  enter?(): void;
  exit?(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
}

export interface SceneParams {
  ocean: undefined;
  shop: undefined;
  cutscene: { fish: FishInstance };
  fight: { fish: FishInstance };
  result: { fish: FishInstance; outcome: FightOutcome; goldEarned: number; perfect?: boolean };
}

export type SceneId = keyof SceneParams;

export interface Game {
  readonly width: number;  // 960
  readonly height: number; // 540
  /** Seconds since boot. */
  readonly time: number;
  input: Input;
  assets: Assets;
  audio: AudioSys;
  state: GameState;
  /** Switch scene. */
  go<K extends SceneId>(id: K, params: SceneParams[K]): void;
}

export type SceneFactory<K extends SceneId> = (game: Game, params: SceneParams[K]) => Scene;
