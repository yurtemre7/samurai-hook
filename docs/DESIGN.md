# SamuraiHook: design and build plan

Status: **awaiting team approval** (2026-11-14). No game code exists yet.

## 1. What we are building and why

A single-player 2D browser game: a deadly serious samurai catches fish and
duels them one on one. It is an endless loop (catch, fight, sell, upgrade, go
deeper) where one round takes under a minute. The point is comedy plus a
tight, polished loop, built as a team project in about 1.5 hours for the
first playable build.

- **Goals:** a complete loop that feels good on keyboard and gamepad; every
  sprite, sound and number editable in one file; a codebase several people
  and agents can work on in parallel.
- **Non-goals for v1:** multiplayer, mobile/touch, a settings menu, story,
  an ending (a settings menu was added later, as a small panel), special-effect equipment, samurai health or reel-speed upgrades.
  *Update 2026-11-15: the mobile/touch non-goal was reversed. The team decided
  to support mobile browsers (landscape only, on-screen buttons plus drag
  steering). See HANDOVER.md, "Mobile browser".*
- **Anti-goals:** fights that feel random or unfair (slips the player could
  not have read); breadth that leaves the core loop unpolished; any asset
  with an unconfirmed licence.

## 2. Decisions from the team (answers to the phase 1 questions)

| Topic | Decision |
|---|---|
| Fight controls | 4-button duel: move, quick slash, heavy slash, defend (hold = block, tap + direction = dash-dodge) |
| Art | CC0 pixel art fetched online; code-drawn placeholder wherever a licence cannot be confirmed |
| Roster | 8 to 10 fish (plan: 9) |
| Shop | 3 endless tracks only: damage, max depth, gold bonus |
| Audio | CC0 sound files (effects and music), licence-checked and credited |
| Humour | Anime fight announcer: "ROUND ONE! SARDINE!", freeze frames, shouted attack names |
| Pull requests | The orchestrator opens a PR per feature branch and merges it after its own checks |
| Gamepad testing | Simulated gamepad in the browser, then a human confirms on real hardware |

Orchestrator's own calls (correct them if wrong):

- Vite + TypeScript + Canvas 2D, no game engine. Vitest for logic tests.
- Progress (gold, upgrade levels) saved in localStorage.
- Endless scaling: below the deepest roster fish, the roster repeats in
  tiers ("Elder", "Legendary", ...) with multiplied health and gold.
- "Equipment" in v1 is the funny name each damage level carries (Rusty
  Katana, Slightly Less Rusty Katana, ...), not separate items.
- Losing a fight costs nothing except the fish.
- Logical resolution 960x540, scaled to fit the window.

## 3. Game design

### 3.1 Screens

```
 OCEAN ──hook touches fish──> CUTSCENE ──> FIGHT ──> RESULT ──> OCEAN
   │                          (2.5 s,               (win: sold
   └──at the surface──> SHOP   skippable)            lose: slipped away)
```

### 3.2 Ocean

The samurai sits in a boat at the surface. Confirm or down drops the hook.
The hook sinks on its own; the player steers left and right, holds down to
sink faster, and presses confirm or up to reel it back in (a gentle
analogue stick tilt up still slows the sink). The camera follows the hook. Fish swim across in
depth bands. Touching any fish starts a fight, so reaching a valuable deep
fish means steering past the cheap ones. At maximum depth (the depth
upgrade) the line reels back up; fish can still be hooked on the way up.
At the surface the player can open the shop. A depth gauge shows the bands.
Target: 5 to 15 seconds.

### 3.3 Cutscene

Freeze, screen split with samurai portrait and fish portrait, announcer
text slams in ("ROUND 7! PUFFERFISH!"), one fish taunt, a gong. 2.5 seconds,
any button skips it.

### 3.4 Fight

Side view on the boat deck, samurai on the left, fish standing on its tail
on the right. Health bars at the top, round timer in the middle.

Samurai moves:

| Move | Detail |
|---|---|
| Walk | left / right |
| Quick slash | fast, short reach, low damage |
| Heavy slash | 0.45 s wind-up, long reach, triple damage |
| Block | hold defend: takes 20% damage, cannot move |
| Dash-dodge | tap defend with a direction: short dash, brief invulnerability |
| Jump | W / up / Space (pad: A or up): ground-only, 120 px high, 0.7 s in the air, air steering; no slash, block or dash in the air |
| Crouch | hold S / down: halves the hurtbox (120 to 60 px) |

Jump and crouch were added after the first build (branch
`feat/jump-crouch-dodge`, pending team review). They exist to answer the
**specials** below; the 4-button duel is otherwise unchanged.

Every fish has a **slip**: when a strike would land,
the fish can dart away (often over the samurai's head) and "SLIPPED!"
appears. After a slip the fish is briefly out of slips (its recovery
window, shown by a sweat-drop and a slower wobble). The skill is to bait a
slip with a quick slash, then land a heavy slash in the window. Slips are
driven by a visible state, not hidden dice, so a miss always has a reason.

Biters do all of that and also bite (the normal attack, which block and
dash stop). Every attack has a wind-up tell (flash and "!"). Piranha: 0.3 s
tell, weak, frequent. Shark: 0.9 s tell, very heavy. Fish with a special
(see above) attack with that too, whatever their category. The samurai's
health bar shows in every fight against a fish that can hurt him: the
biters in both modes, and the eel, pufferfish and squid in hard mode only.

**Dodge-only specials.** Slippery fish stay harmless in normal mode, as
decided on 2026-11-14. A **hard mode** switch in the settings panel (off by
default, saved) gives the eel, pufferfish and squid their specials too, so
they can hurt. The swordfish and shark are biters and use theirs in both
modes. In code the mode is applied in one place, `makeFish` in
`src/game/state.ts`, which drops `special` from slippery fish when hard mode
is off. Eel, pufferfish, swordfish, shark and squid each have a special: the fish
backs off, flashes purple and shows JUMP! or DUCK! with a danger band at the
hit height, then attacks. Block and dash invulnerability do not help; only
jumping or ducking does. Swordfish: low charge across the deck. Eel: floor
shock wave. Pufferfish: two spines at head height. Shark: tail-slap floor
wave. Squid: ink shots high, low, high. High shots can only be ducked (the
jump apex stays below them). Striking the fish during a special's tell,
charge or volley lands, stuns it and costs the special its full cooldown.
Jumping above the fish's reach also dodges a biter's lunge. A fish with no
attack and no special never hurts the samurai, which in normal mode includes
the eel, pufferfish and squid.

Outcomes: fish health zero = "K.O.!", the fish becomes nigiri and is sold.
Timer zero = "TIME! IT WAS... TOO SLIPPERY." Samurai health zero = "YOU
GOT BITTEN." No gold on a loss.

### 3.5 Roster (starting values; tuned in phase 3)

Samurai base: quick slash 6, heavy slash 18, health 100.

| # | Fish | Type | Depth (m) | HP | Timer | Gold | Character |
|---|---|---|---|---|---|---|---|
| 1 | Sardine | slippery | 5-25 | 40 | 20 s | 5 | tutorial fish, rarely slips |
| 2 | Mackerel | slippery | 15-40 | 70 | 25 s | 12 | weaves, moderate slips |
| 3 | Piranha | biter | 30-55 | 90 | 25 s | 25 | fast weak bites (6), 0.3 s tell |
| 4 | Eel | slippery | 40-70 | 80 | 30 s | 40 | slips almost everything, tiny recovery window; special: floor shock wave (jump) |
| 5 | Pufferfish | slippery | 55-90 | 160 | 30 s | 70 | inflates, hitting it bounces the samurai back; special: two head-height spines (duck) |
| 6 | Swordfish | biter | 75-110 | 200 | 30 s | 120 | fencing lunges (15), 0.5 s tell, long reach; special: low charge across the deck (jump) |
| 7 | Anglerfish | slippery | 95-130 | 260 | 40 s | 200 | arena dims; only its lure glows; no attack, stays harmless |
| 8 | Shark | biter | 115-150 | 400 | 40 s | 350 | slow heavy bite (35), 0.9 s tell; special: tail-slap floor wave (jump) |
| 9 | Giant Squid | slippery | 140-170 | 480 | 40 s | 600 | ink splats hide part of the screen; special: ink shots high, low, high |

Six slippery, three biters. Five fish have a dodge-only special (eel,
pufferfish, swordfish, shark, squid); the eel, pufferfish and squid use it
in hard mode only. Sardine, mackerel and anglerfish never hurt the samurai.
The specials in the rows below are therefore hard-mode behaviour for the
three slippery fish. All nine share one behaviour model driven by config
numbers; only pufferfish, anglerfish and squid have a gimmick. Numbers in
this table follow `src/manifest.ts`, which is the source of truth.

### 3.6 Shop and economy

| Track | Effect per level | Cost |
|---|---|---|
| Damage | +25% of base damage | 20 x 1.5^level |
| Max depth | +15 m (starts at 135 m) | 30 x 1.45^level |
| Gold bonus | +15% gold per fish | 40 x 1.6^level |

Past 170 m the roster repeats: each tier multiplies fish health by 2.2 and
gold by 2.5, so the loop never runs out. All numbers live in the manifest.

### 3.7 Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move / steer | A D or arrow keys (W S or up/down in ocean) | left stick or d-pad |
| Confirm / drop hook / skip | Space or Enter | A (bottom) |
| Quick slash | J | X (left) |
| Heavy slash | K | Y (top) |
| Defend | L or Shift | B (right) or RB |
| Jump (fight) | W, up or Space | A (bottom) or stick up |
| Crouch (fight) | S or down (held) | stick down (mostly vertical tilt only) |
| Settings (boat and shop) | Esc or Tab | Select (Back) |
| Shop (at surface) | E | Y (top) |

Prompts are always on screen and switch glyphs to whichever device was
used last. The only settings are a small panel at the boat and in the shop:
music volume, sound effects volume (announcer included), hard mode and a
keybinds page (first and second keyboard key for every action; the gamepad
layout is fixed).

## 4. Approaches considered

1. **Vite + TypeScript + Canvas 2D, hand-rolled (chosen).** Smallest
   footprint, full control of game feel, pure-logic modules are easy to
   unit test, nothing for teammates to learn. Cost: we write our own scene
   manager, sprite drawing and gamepad layer (all small).
2. **Phaser 3.** Scenes, sprites, audio and gamepad support included.
   Cost: a large API that every subagent must use consistently, harder to
   keep the fight logic pure and testable, and its input layer does not
   give us the last-used-device prompt switching for free.
3. **DOM and CSS sprites.** Fastest UI and text, but the fight needs
   per-frame collision and animation, where canvas is simpler.

## 5. Architecture

```
index.html
src/
  main.ts            boot: load assets, start loop, first scene
  manifest.ts        THE one file: sprites, sounds, fish, upgrades, timers, all text
  types.ts           shared contracts (written first, by the orchestrator)
  core/
    loop.ts          fixed-step update, render
    scenes.ts        Scene interface and SceneManager
    assets.ts        image/sound loader; falls back to a drawn placeholder
    audio.ts         play(soundId), music
    save.ts          localStorage
  input/
    input.ts         actions from keyboard + gamepad, last-used device
    prompts.ts       glyph for (action, device), prompt bar drawing
  game/
    state.ts         gold, upgrade levels, derived stats, tier scaling
  fight/
    sim.ts           pure fight simulation: no DOM, no canvas, deterministic
    fishAi.ts        fish behaviour from config
  scenes/
    ocean.ts  cutscene.ts  fight.ts  result.ts  shop.ts
  ui/
    hud.ts           bars, timer, announcer text, depth gauge
public/assets/       sprites and sounds
tests/               vitest: fight sim, economy, input mapping
```

Rules that keep people out of each other's way:

- Game logic reads numbers and asset paths only from `manifest.ts`.
- Scenes talk to each other only through `SceneManager` and `game/state.ts`.
- `fight/sim.ts` takes input actions and a time step and returns state;
  `scenes/fight.ts` only draws that state and plays sounds for its events.
- Every sprite is drawn through `assets.ts`, which draws a labelled
  coloured shape if the image is missing, so the game never waits on art.

## 6. Work split

The orchestrator writes the scaffold and `types.ts` first, so every agent
builds against fixed interfaces. Each agent works on its own branch and
worktree, owns the listed files only, reads HANDOVER.md first, and ends
with a PR. The orchestrator reviews, runs checks, and merges.

Wave 1 (parallel):

| Agent | Model | Branch | Owns | Done when |
|---|---|---|---|---|
| Input | Opus 5.5 | `feat/input` | `src/input/*`, input tests | actions work from keyboard and a mocked gamepad; device switch flips glyphs; tests pass |
| Fight logic | Opus 5.5 | `feat/fight-sim` | `src/fight/*`, sim tests | scripted fights in tests: win, timeout, biter win, biter loss; slips follow the visible state |
| Game state | Opus 5.5 | `feat/state` | `src/game/*`, `src/core/save.ts`, tests | costs, derived stats, tier scaling and save/load tested |
| Ocean | Sonnet 5.5 | `feat/ocean` | `src/scenes/ocean.ts` | hook drops, steers, collides, hands the fish to the scene manager |
| Assets | Sonnet 5.5 | `feat/assets` | `public/assets/*`, `CREDITS.md`, asset entries in manifest | every file has a confirmed licence and a CREDITS row; gaps are listed. Time-boxed to 25 minutes |
| Screens | Sonnet 5.5 | `feat/screens` | `src/scenes/cutscene.ts`, `result.ts`, `shop.ts`, `src/ui/hud.ts` | each screen runs standalone with fake data |

Wave 2:

| Agent | Model | Branch | Owns | Done when |
|---|---|---|---|---|
| Fight scene | Opus 5.5 | `feat/fight-scene` | `src/scenes/fight.ts` | draws the sim, hit-stop, shake, announcer calls, sounds |
| Verification | Sonnet 5.5 | none | none (reports only) | plays the test script in a browser and reports failures |

The orchestrator does integration (`main.ts`, wiring), the final browser
play-through, and all tuning.

## 7. Time budget (90 minutes to first playable)

| Minutes | Work |
|---|---|
| 0-10 | Scaffold, `types.ts`, manifest skeleton, bootstrap commit |
| 10-40 | Wave 1, six agents in parallel |
| 40-50 | Review and merge wave 1 |
| 50-65 | Wave 2: fight scene, wiring, audio and announcer hookup |
| 65-80 | Browser play-through, bug fixes |
| 80-90 | First tuning pass |

A longer tuning pass follows the first playable build.

## 8. Honest evaluation

**Risks**

1. **Assets are the biggest risk.** Three of the choices (nine fish, CC0
   art, CC0 sound files) all add sourcing and licence-checking time. A
   CC0 animated samurai in particular may not exist in a matching style.
   Mitigation: the asset agent is time-boxed, the placeholder fallback is
   built first, and the game is playable with zero fetched assets.
2. **Slippery fights can feel unfair.** If slips look random, the game is
   a coin flip. Mitigation: slips come from a visible state with a clear
   recovery window; this is the main target of tuning.
3. **Nine fish in 90 minutes means shallow variety.** Six of them differ
   only in numbers at first. That is acceptable for v1 but the deep fish
   will need a second pass.
4. **Three shop tracks** means samurai health never grows, so the shark
   must be beatable on skill alone at base health. Tuning has to respect
   that.
5. **Parallel agents can drift from the contracts.** Mitigation:
   `types.ts` is frozen before wave 1; changes to it go through the
   orchestrator.

**Cut order if time runs short** (first cut first): squid ink, anglerfish
darkness, music, swordfish, pufferfish bounce, sprite animation frames,
tier name prefixes. The loop, both fish categories, input and prompts are
never cut.

**What would make it funnier or more fun**

- A spoken announcer using the browser's built-in speech synthesis: a
  flat robot voice shouting "SARDINE!" costs ten lines and no assets.
  Recommended; needs a yes from the team.
- The samurai bows to every fish before the round; the fish does not bow.
- Beaten fish turn into a single piece of nigiri that is sold with a
  receipt ("SOLD TO SUSHI-YA: 5 G").
- "PERFECT!" for beating a sardine without a miss; "FLAWLESS SLIP!" from
  the announcer when the player whiffs three times in a row.
- Fish titles on the health bar ("MACKEREL, 3RD DAN").

**Later iterations:** real equipment with effects, reel-speed and health
upgrades, perfect-block parry, more gimmick fish and a boss, a bestiary,
touch controls.

## 9. Verification plan

Before the first playable is called done, in a browser: win against a
slippery fish, lose by timeout, win and lose against a biter, sell,
upgrade each track, and reach a new depth band. Repeat the loop on
keyboard and on a simulated gamepad, switching mid-game to check the
prompts. A human then confirms on a real controller. Logic tests cover
the fight simulation, the economy and input mapping.
