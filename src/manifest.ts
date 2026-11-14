// THE one file for art, sound, text and tuning.
// Swap a sprite, rebalance a fish or change a price here; no game logic needs to change.
// See README.md ("Add a fish", "Swap an asset").

import type { FishDef, SoundDef, SpriteDef, UpgradeDef } from './types';

// ---------- Sprites ----------
// src: null means "draw the placeholder". Put files under public/assets and
// record every one in CREDITS.md.

const fishSprite = (color: string, label: string, w = 96, h = 64): SpriteDef => ({
  src: null, w, h, facing: 'right', placeholder: { shape: 'fish', color, label },
});

export const sprites: Record<string, SpriteDef> = {
  samuraiIdle:  { src: 'assets/samurai/idle.png', w: 456, h: 173, facing: 'right', frames: 8, fps: 8, placeholder: { shape: 'samurai', color: '#c0392b' } },
  samuraiWalk:  { src: 'assets/samurai/walk.png', w: 456, h: 173, facing: 'right', frames: 8, fps: 12, placeholder: { shape: 'samurai', color: '#c0392b' } },
  samuraiQuick: { src: 'assets/samurai/quick.png', w: 456, h: 173, facing: 'right', frames: 6, fps: 18, placeholder: { shape: 'samurai', color: '#e74c3c', label: 'SLASH' } },
  samuraiHeavy: { src: 'assets/samurai/heavy.png', w: 456, h: 173, facing: 'right', frames: 6, fps: 10, placeholder: { shape: 'samurai', color: '#f39c12', label: 'HEAVY' } },
  samuraiBlock: { src: 'assets/samurai/block.png', w: 456, h: 173, facing: 'right', placeholder: { shape: 'samurai', color: '#7f8c8d', label: 'BLOCK' } },
  samuraiHurt:  { src: 'assets/samurai/hurt.png', w: 456, h: 173, facing: 'right', frames: 4, fps: 12, placeholder: { shape: 'samurai', color: '#ffffff', label: 'OW' } },
  // In the boat he is a simple seated figure; the detailed fighter appears only in duels.
  samuraiSit:   { src: null, w: 64, h: 72, placeholder: { shape: 'fisher', color: '#2c3e63' } },
  boat:         { src: null, w: 200, h: 56, placeholder: { shape: 'boat', color: '#8e5a2b' } },
  hook:         { src: null, w: 20, h: 28,  placeholder: { shape: 'hook', color: '#dfe6e9' } },
  nigiri:       { src: null, w: 72, h: 48,  placeholder: { shape: 'nigiri', color: '#ff8c5a' } },

  'fish.sardine':    { ...fishSprite('#b8c6d1', 'SARDINE', 56, 32), src: 'assets/fish/sardine.png', facing: 'left' },
  'fish.mackerel':   { ...fishSprite('#4f8fba', 'MACKEREL', 78, 42), src: 'assets/fish/mackerel.png', facing: 'left' },
  'fish.piranha':    { ...fishSprite('#d35454', 'PIRANHA', 70, 60), src: 'assets/fish/piranha.png', facing: 'left' },
  'fish.eel':        { ...fishSprite('#6b8e23', 'EEL', 144, 40), src: 'assets/fish/eel.png', facing: 'left' },
  'fish.pufferfish': { ...fishSprite('#e6c34a', 'PUFFER', 81, 69), src: 'assets/fish/pufferfish.png', facing: 'right' },
  'fish.swordfish':  fishSprite('#5d6d9e', 'SWORDFISH', 150, 56),
  'fish.anglerfish': fishSprite('#5b3a6b', 'ANGLER', 110, 88),
  'fish.shark':      { ...fishSprite('#7d8a97', 'SHARK', 188, 60), src: 'assets/fish/shark.png', facing: 'left' },
  'fish.squid':      { ...fishSprite('#c0567a', 'SQUID', 140, 118), src: 'assets/fish/squid.png', facing: 'left' },
};

// ---------- Sounds ----------
// src: null plays a synthesised blip from `fallback`, so the game is never silent.

const blip = (freq: number, dur: number, wave: OscillatorType = 'square'): SoundDef => ({
  src: null, volume: 0.6, fallback: { freq, dur, wave },
});

export const sounds: Record<string, SoundDef> = {
  uiMove:    { ...blip(660, 0.04), src: 'assets/sfx/ui_move.ogg', volume: 0.5 },
  uiConfirm: { ...blip(880, 0.08), src: 'assets/sfx/ui_confirm.ogg', volume: 0.5 },
  uiDeny:    blip(160, 0.12, 'sawtooth'),
  splash:    { ...blip(220, 0.18, 'triangle'), src: 'assets/sfx/splash.ogg', volume: 0.7 },
  hooked:    blip(520, 0.2, 'triangle'),
  gong:      { ...blip(110, 0.9, 'sine'), src: 'assets/sfx/gong.ogg', volume: 0.7 },
  slash:     { ...blip(900, 0.06, 'sawtooth'), src: 'assets/sfx/slash.ogg', volume: 0.6 },
  heavy:     { ...blip(300, 0.16, 'sawtooth'), src: 'assets/sfx/heavy.ogg', volume: 0.7 },
  hit:       { ...blip(180, 0.1, 'square'), src: 'assets/sfx/hit.ogg', volume: 0.7 },
  slip:      { ...blip(1200, 0.12, 'sine'), src: 'assets/sfx/slip.wav', volume: 0.5 },
  tell:      { ...blip(1500, 0.08, 'square'), src: 'assets/sfx/tell.ogg', volume: 0.4 },
  bite:      blip(90, 0.2, 'sawtooth'),
  block:     { ...blip(400, 0.07, 'triangle'), src: 'assets/sfx/block.ogg', volume: 0.6 },
  dash:      { ...blip(700, 0.07, 'sine'), src: 'assets/sfx/dash.wav', volume: 0.5 },
  ko:        { ...blip(70, 0.6, 'sawtooth'), src: 'assets/sfx/ko.ogg', volume: 0.8 },
  lose:      blip(140, 0.7, 'triangle'),
  coin:      { ...blip(1320, 0.14, 'square'), src: 'assets/sfx/coin.wav', volume: 0.5 },
  buy:       { ...blip(990, 0.2, 'triangle'), src: 'assets/sfx/buy.ogg', volume: 0.6 },
};

/** Looping music tracks. src: null = no music. */
export const music: Record<string, { src: string | null; volume: number }> = {
  ocean: { src: 'assets/music/ocean.mp3', volume: 0.35 },
  fight: { src: 'assets/music/fight.ogg', volume: 0.4 },
};

/** Spoken announcer (browser speech synthesis). */
export const voice = { enabled: true, rate: 1.15, pitch: 0.6, volume: 1 };

// ---------- Fish ----------
// Depth bands are for tier 0. Deeper than `tiers.depth`, the roster repeats.

export const fish: FishDef[] = [
  {
    id: 'sardine', name: 'Sardine', title: 'WHITE BELT', category: 'slippery', sprite: 'fish.sardine',
    depthMin: 5, depthMax: 25, hp: 40, timer: 20, gold: 5, swimSpeed: 70, size: 32,
    move: { speed: 150, keepAway: 120, restless: 0.3 },
    slip: { recovery: 3.0, dart: 180 },
    gimmick: 'none',
    taunts: ['I AM ONE OF MILLIONS!', 'YOU CANNOT CAN ME!', 'SMALL FISH. BIG DREAMS.'],
  },
  {
    id: 'mackerel', name: 'Mackerel', title: '3RD DAN', category: 'slippery', sprite: 'fish.mackerel',
    depthMin: 15, depthMax: 40, hp: 70, timer: 25, gold: 12, swimSpeed: 95, size: 40,
    move: { speed: 200, keepAway: 140, restless: 0.5 },
    slip: { recovery: 2.0, dart: 240 },
    gimmick: 'none',
    taunts: ['HOLY ME!', 'YOUR BLADE IS DULL. LIKE YOUR BAIT.', 'CATCH THIS? UNLIKELY!'],
  },
  {
    id: 'piranha', name: 'Piranha', title: 'THE NIBBLER', category: 'biter', sprite: 'fish.piranha',
    depthMin: 30, depthMax: 55, hp: 90, timer: 25, gold: 25, swimSpeed: 120, size: 38,
    move: { speed: 260, keepAway: 110, restless: 0.8 },
    slip: { recovery: 1.8, dart: 200 },
    attack: { damage: 6, tell: 0.3, cooldown: 1.1, reach: 150 },
    gimmick: 'none',
    taunts: ['NOM. NOM. NOM.', 'I SKIPPED LUNCH FOR THIS!', 'DEATH BY A THOUSAND NIBBLES!'],
  },
  {
    id: 'eel', name: 'Eel', title: 'GRAND SLIPMASTER', category: 'slippery', sprite: 'fish.eel',
    depthMin: 40, depthMax: 70, hp: 80, timer: 30, gold: 40, swimSpeed: 110, size: 42,
    move: { speed: 280, keepAway: 130, restless: 0.7 },
    slip: { recovery: 0.9, dart: 320 },
    gimmick: 'none',
    taunts: ['SHOCKING, ISN\'T IT?', 'TOO SLIPPERY FOR YOU, OLD MAN!', 'EEL BE BACK.'],
  },
  {
    id: 'pufferfish', name: 'Pufferfish', title: 'THE ROUND ONE', category: 'slippery', sprite: 'fish.pufferfish',
    depthMin: 55, depthMax: 90, hp: 160, timer: 30, gold: 70, swimSpeed: 60, size: 44,
    move: { speed: 140, keepAway: 120, restless: 0.3 },
    slip: { recovery: 2.2, dart: 160 },
    gimmick: 'puff',
    taunts: ['DO NOT TOUCH. SERIOUSLY.', 'I AM INFLATING MY EGO!', 'ONE BITE AND YOU DIE. OF ME.'],
  },
  {
    id: 'swordfish', name: 'Swordfish', title: 'RIVAL DUELLIST', category: 'biter', sprite: 'fish.swordfish',
    depthMin: 75, depthMax: 110, hp: 200, timer: 30, gold: 120, swimSpeed: 150, size: 40,
    move: { speed: 230, keepAway: 220, restless: 0.5 },
    slip: { recovery: 1.6, dart: 260 },
    attack: { damage: 15, tell: 0.5, cooldown: 1.8, reach: 280 },
    gimmick: 'none',
    taunts: ['EN GARDE!', 'MY SWORD IS ATTACHED. IS YOURS?', 'I WAS BORN ARMED!'],
  },
  {
    id: 'anglerfish', name: 'Anglerfish', title: 'LIGHTS OUT', category: 'slippery', sprite: 'fish.anglerfish',
    depthMin: 95, depthMax: 130, hp: 260, timer: 40, gold: 200, swimSpeed: 55, size: 44,
    move: { speed: 170, keepAway: 150, restless: 0.5 },
    slip: { recovery: 1.6, dart: 240 },
    gimmick: 'dark',
    taunts: ['COME TOWARD THE LIGHT.', 'I HAVE SEEN THINGS. DARK THINGS.', 'WHO TURNED OFF THE OCEAN?'],
  },
  {
    id: 'shark', name: 'Shark', title: 'FINAL-ISH BOSS', category: 'biter', sprite: 'fish.shark',
    depthMin: 115, depthMax: 150, hp: 400, timer: 40, gold: 350, swimSpeed: 90, size: 56,
    move: { speed: 150, keepAway: 200, restless: 0.4 },
    slip: { recovery: 2.4, dart: 200 },
    attack: { damage: 35, tell: 0.9, cooldown: 2.6, reach: 260 },
    gimmick: 'none',
    taunts: ['WE\'RE GONNA NEED A BIGGER SAMURAI.', 'I SMELL HONOUR. AND LUNCH.', 'DUN DUN. DUN DUN.'],
  },
  {
    id: 'squid', name: 'Giant Squid', title: 'EIGHT-ARMED STYLE', category: 'slippery', sprite: 'fish.squid',
    depthMin: 140, depthMax: 170, hp: 480, timer: 40, gold: 600, swimSpeed: 50, size: 60,
    move: { speed: 190, keepAway: 170, restless: 0.6 },
    slip: { recovery: 1.5, dart: 280 },
    gimmick: 'ink',
    taunts: ['TECHNICALLY NOT A FISH!', 'INK ABOUT YOUR LIFE CHOICES.', 'I AM ARMED. EIGHT TIMES.'],
  },
];

/** Endless scaling: every `depth` metres the roster repeats, tougher and richer. */
export const tiers = {
  depth: 170,
  hpMult: 2.2,
  goldMult: 2.5,
  prefixes: ['', 'ELDER', 'LEGENDARY', 'MYTHIC', 'COSMIC', 'FORBIDDEN'],
};

// ---------- Samurai and fight tuning ----------

export const samurai = {
  maxHp: 100,
  quickDamage: 6,
  heavyDamage: 18,
};

export const fight = {
  arena: { left: 60, right: 900, floorY: 440 },
  samurai: {
    walkSpeed: 260,
    bodyRadius: 30,
    quick: { startup: 0.06, active: 0.08, recovery: 0.14, reach: 110 },
    heavy: { startup: 0.45, active: 0.1, recovery: 0.3, reach: 150 },
    blockReduction: 0.65,   // fraction of damage removed while blocking
    dash: { distance: 170, duration: 0.18, iframes: 0.22, cooldown: 0.5 },
    hurtStun: 0.25,
    hurtKnockback: 240,    // px/s pushed away on a bite, decays over hurtStun
    blockPush: 120,        // px/s pushed back on a blocked bite, decays over 0.15 s
    buffer: 0.12,          // seconds a slash pressed during another move is remembered
  },
  fish: {
    slipDuration: 0.3,     // seconds the dart takes
    slipArc: 50,           // dart height when it darts away on its own side, px
    overArc: 170,          // dart / cross height when it goes over the samurai, px
    hitHeight: 70,         // a fish higher than this above the floor cannot be struck
    hitStun: 0.12,
    hitPush: 180,          // px/s the fish is knocked back by a landed hit
    lungeDuration: 0.2,    // seconds a biter's lunge takes
    lungeRecovery: 0.8,    // seconds a biter stays vulnerable after a lunge (or an interrupted tell)
    crossCooldown: 1.2,    // seconds between corner escapes over the samurai
    puff: { every: 4.5, duration: 1.6, knockback: 260, stun: 0.5 },
    ink: { every: 6, duration: 3 },
    darkRadius: 150,       // visible radius around the samurai in 'dark' fights
  },
  hitStop: 0.06,           // freeze on a landed hit, seconds
  introDelay: 1.0,         // "FIGHT!" delay before the timer starts
};

// ---------- Ocean tuning ----------

export const ocean = {
  startDepth: 25,          // max depth at upgrade level 0, metres
  pxPerMetre: 14,
  surfaceY: 150,           // screen y of the water line when the camera is at the top
  hook: { sinkSpeed: 150, fastSinkSpeed: 300, brakeSpeed: 60, reelSpeed: 260, steerSpeed: 260, radius: 12 },
  fishPerScreen: 8,
  catchRadiusScale: 0.8,   // multiplied by the fish's half-width
};

// ---------- Shop ----------

export const upgrades: UpgradeDef[] = [
  {
    id: 'damage', label: 'BLADE', baseCost: 20, growth: 1.5, perLevel: 0.25,
    names: [
      'Rusty Katana', 'Slightly Less Rusty Katana', 'Katana (Washed)', 'Sharp Katana',
      'Very Sharp Katana', 'Katana of Mild Peril', 'Fishbane', 'Fishbane II: The Refishening',
      'Legendary Sashimi Knife', 'Blade of a Thousand Fillets',
    ],
  },
  {
    id: 'depth', label: 'LINE', baseCost: 30, growth: 1.45, perLevel: 15,
    names: [
      'Old String', 'Longer String', 'Actual Fishing Line', 'Rope', 'Long Rope',
      'Suspiciously Long Rope', 'Anchor Chain', 'Abyssal Cable', 'The Bottomless Line',
    ],
  },
  {
    id: 'gold', label: 'REPUTATION', baseCost: 40, growth: 1.6, perLevel: 0.15,
    names: [
      'Unknown Angler', 'Local Nuisance', 'Market Regular', 'Sushi Supplier',
      'Feared By Fishmongers', 'Sashimi Tycoon', 'Emperor\'s Fishmonger', 'Legend of the Seven Seas',
    ],
  },
];

// ---------- Text ----------
// {fish}, {round}, {gold}, {title} are filled in by the scenes.

export const text = {
  title: 'SAMURAI HOOK',
  cutscene: { round: 'ROUND {round}!', versus: 'SAMURAI  VS  {fish}', fight: 'FIGHT!' },
  samuraiLines: [
    'A WORTHY OPPONENT.', 'DRAW YOUR FINS.', 'TODAY, ONE OF US BECOMES SUSHI.',
    'I HAVE TRAINED 40 YEARS FOR THIS SARDINE.', 'HONOUR DEMANDS A FILLET.',
  ],
  slip: ['SLIPPED!', 'TOO SLIPPERY!', 'WHIFF!', 'NOPE!'],
  hit: ['HIT!', 'SLICE!', 'FILLET!'],
  heavyHit: ['KATANA SMASH!', 'DISHONOUR CUTTER!', 'MEGA FILLET!'],
  block: 'BLOCKED!',
  bounce: 'BOING!',
  win: { banner: 'K.O.!', perfect: 'PERFECT!', sold: 'SOLD TO SUSHI-YA: {gold} G' },
  timeout: { banner: 'TIME!', sub: 'IT WAS... TOO SLIPPERY.' },
  ko: { banner: 'YOU GOT BITTEN.', sub: '{fish} SWIMS AWAY, UNDEFEATED.' },
  announce: {
    round: 'Round {round}! {fish}!',
    fight: 'Fight!',
    win: 'K. O.!',
    perfect: 'Perfect!',
    timeout: 'Time! Too slippery!',
    ko: 'You got bitten!',
    buy: 'Upgrade!',
  },
  shop: { title: 'DOCKSIDE DOJO SHOP', broke: 'NOT ENOUGH GOLD', gold: '{gold} G' },
};
