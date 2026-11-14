# SamuraiHook

A small, funny 2D browser game. A deadly serious samurai sits in a boat,
lowers a hook, and duels whatever fish he catches, one on one, like a
classic fighting game. Catch, fight, sell, upgrade, go deeper, repeat.

Status, open tasks and decisions live in [HANDOVER.md](HANDOVER.md). The
design is in [docs/DESIGN.md](docs/DESIGN.md). Asset licences are in
[CREDITS.md](CREDITS.md).

Play it online: https://yurtemre7.github.io/team-1-game-samurai-hook/

## Run it

Needs Node 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

Other commands:

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (fight logic, economy, input) |
| `npm run build` | Production build into `dist/` |

## Controls

Keyboard and gamepad both work at any time; the prompts at the bottom of
the screen switch to whichever you used last.

| Action | Keyboard | Gamepad |
|---|---|---|
| Move / steer the hook | A D or arrow keys (W S or up/down to brake / sink faster) | left stick or d-pad |
| Confirm, drop hook, skip | Space or Enter | A |
| Quick slash | J | X |
| Heavy slash | K | Y |
| Defend: hold to block, tap with a direction to dash-dodge | L or Shift | B or RB |
| Shop (at the surface) | E | Y |

### Demo shortcuts

| Shortcut | What it does |
|---|---|
| F2, or open the page with `?start=demo` | Start with progress: 1500 ryo, blade level 4, line level 6 (115 m), reputation level 2. Change the preset in `demoStart` in `src/manifest.ts`. |
| F4, or `?start=fresh` | Wipe the save and start over. |

## How to play

1. Drop the hook and steer it. Touching any fish starts a duel, so steer
   past the small fry to reach the valuable fish deeper down.
2. Win the duel before the timer runs out. Fish are slippery: a fish that
   is ready to slip dodges your next strike, then is briefly helpless.
   Bait the slip with a quick slash, then land heavy slashes.
3. Some fish bite. Watch for the wind-up, then block or dash.
4. Beaten fish are sold automatically. Spend the gold in the shop on a
   better blade, a longer line, or a better reputation (more gold).

## Change the game without touching game logic

Everything adjustable lives in one file: [src/manifest.ts](src/manifest.ts).

### Rebalance a fish

Edit its entry in the `fish` array: `hp`, `timer`, `gold`, the depth band
(`depthMin`, `depthMax`), movement, `slip.recovery` (how long it stays
helpless after slipping) and, for biters, `attack`.

### Add a fish

1. Add a sprite entry to `sprites`, for example `'fish.tuna'`. With
   `src: null` the game draws a labelled placeholder, so art can come later.
2. Add an entry to the `fish` array with a unique `id`, `sprite:
   'fish.tuna'`, a depth band, stats and a few `taunts`. Leave out `attack`
   for a slippery fish; add it for a biter.

That is all: the ocean, the fight, the announcer and the depth gauge pick
it up from the manifest. Run `npm test` afterwards; one test checks that
every depth has at least one fish.

### Swap a sprite

1. Put the image in `public/assets/...`.
2. Point the sprite's `src` at it (path relative to `public/`), set `w`
   and `h` (draw size in game pixels on the 960x540 canvas) and `facing`
   (which way the art faces). For an animation, use a horizontal strip of
   equal-width frames and set `frames` and `fps`.
3. Add a row to CREDITS.md with the source URL, author and licence. Only
   CC0, public domain or CC-BY assets are accepted.

### Swap a sound or the music

Same idea in `sounds` and `music`: set `src` and `volume`. A sound with
`src: null` plays a synthesised blip. The spoken announcer is the browser's
speech synthesis; turn it off or change its pitch in `voice`.

### Prices and scaling

`upgrades` holds each shop track's base cost, growth factor, effect per
level and level names. `tiers` controls how the roster repeats, tougher and
richer, below the deepest fish. `samurai`, `fight` and `ocean` hold the
remaining tuning numbers.

## Code layout

```
src/
  main.ts        boot, game loop, scene switching
  manifest.ts    all art, sound, text and tuning
  types.ts       shared contracts between modules
  core/          asset loading and drawing, audio
  input/         keyboard + gamepad actions, prompt glyphs
  game/          gold, upgrades, fish scaling, saving
  fight/         pure fight simulation (no drawing), fish behaviour
  scenes/        ocean, cutscene, fight, result, shop
  ui/            HUD drawing helpers
tests/           unit tests
```

Jump straight to a scene while developing:
`http://localhost:5173/?scene=fight&fish=shark&tier=0`
(`scene` is one of ocean, cutscene, fight, result, shop). `game` is
available in the browser console, for example `game.state.reset()`.

## Contributing

Read HANDOVER.md first. Work on a short-lived branch, keep commits small,
open a pull request against `main`, and update HANDOVER.md in the same
commit as the work.
