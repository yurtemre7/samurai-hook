# HANDOVER

Shared source of truth for project status. Read this before starting any
work, and update it in the same commit as the work.

Last updated: 2026-11-14 (first playable build)

## Current state

- **First playable build is on `main`.** The whole loop works: ocean, hook-up
  cutscene, fight, result, shop, repeat, with saving.
- How to run: `npm install`, then `npm run dev` and open
  http://localhost:5173. Checks: `npm run typecheck`, `npm test` (47 tests).
  README.md has controls and how to add a fish or swap an asset.
- Jump to a scene while developing:
  `http://localhost:5173/?scene=fight&fish=shark&tier=0`. In the browser
  console `game` is the game object (`game.state.reset()` wipes the save) and,
  during a fight, `__fight` is the running simulation.
- Art: real CC0 / CC-BY sprites for the fight samurai (LuizMelo "Martial
  Hero"), sardine, mackerel, piranha, eel, shark, pufferfish and squid.
  Sound: 14 effects and two music tracks. Everything is listed in CREDITS.md.
- Still code-drawn placeholders: swordfish, anglerfish, boat, hook, nigiri.
  The samurai in the boat is drawn in code on purpose (a simple meditating
  figure, by team request); the detailed fighter appears only in duels.
- Still synthesised blips: `bite`, `lose`, `hooked`, `uiDeny`.

### Verified in a browser on 2026-11-14 (by the orchestrator, scripted input)

- Keyboard: drop hook, hook a sardine, skip cutscene, win, gold +5, back to
  the ocean. Timeout loss against a sardine with no input: no gold.
- Simulated gamepad (a fake pad behind `navigator.getGamepads`): win against
  a piranha (biter) and a mackerel, knockout loss against the shark, open the
  shop, buy the blade upgrade, refused purchase when short of gold, back to
  the ocean. Prompts switched to A / Y / stick glyphs.
- No console errors in any of the above.
- **Not verified:** a real controller, a human actually playing (all input
  was scripted, so feel and difficulty for people are untested), and sound
  (calls are made; nobody has listened to the files or the spoken announcer).

## In progress

Nothing. All branches are merged.

## Pending (in priority order)

1. **Play it as a human, on keyboard and a real controller**, and note what
   feels off. All tuning so far comes from a scripted bot.
2. **Listen to the sounds.** They were picked by file name. Swap any that do
   not fit in the `sounds` block of `src/manifest.ts`; find CC0 files for
   `bite`, `lose`, `hooked`, `uiDeny`.
3. **Missing art:** side-view swordfish, anglerfish, boat, hook, nigiri
   (CC0 or CC-BY only). The squid sprite is a cute stand-in; a more
   monstrous one would fit better. Kenney.nl blocked scripted downloads, so
   a person can fetch its Pirate Pack (boat, hook) by hand.
4. **Tuning** in `src/manifest.ts`: run `npm test` to print the balance
   table (bot results per fish and damage level). Known soft spots: early
   fish die in 1 or 2 hits from damage level 6; bite damage does not grow
   with tier; a straight hook drop can miss every fish.
5. **Move scene constants into the manifest:** the four texts at the top of
   `src/scenes/fight.ts` (`SAMURAI_SAFE_SUB`, `DODGED_TEXT`, `PUFF_TEXT`,
   `SAMURAI_LABEL`), cutscene and result timings, and the ocean layout
   constants at the top of `src/scenes/ocean.ts`.
6. `tint` in `src/core/assets.ts` colours the sprite's whole rectangle, not
   just its pixels. The fight scene works around it with a scratch canvas;
   fix it in `assets.ts` and remove the workaround.
7. Add `vulnLeft` to the fight state so the "OPEN" ring is exact instead of
   estimated from tuning.
8. Later ideas (docs/DESIGN.md, section 8): equipment with effects, health
   and reel-speed upgrades, parry, a boss, a bestiary.

## Decisions

Team answers (2026-11-14):

- Fight controls: 4-button duel (move, quick slash, heavy slash, defend).
- Art: CC0 pixel art; code-drawn placeholders where no licence is confirmed.
- Roster: 8 to 10 fish; the plan has 9.
- Shop: 3 endless tracks only (damage, max depth, gold bonus).
- Audio: CC0 sound files, credited.
- Humour: anime fight announcer.
- PRs: the orchestrator merges its own PRs after its checks.
- Gamepad: tested with a simulated gamepad, then confirmed by a human.

Orchestrator's calls (small and reversible):

- Vite + TypeScript + Canvas 2D, no engine, because the fight logic stays
  pure and testable and there is no framework for the team to learn.
- Progress is saved in localStorage.
- Below 170 m the roster repeats in tougher, richer tiers.
- "Equipment" is the name of each damage level, not separate items.
- Losing a fight costs only the fish.
- The design doc lives at docs/DESIGN.md.
- The plan was approved on 2026-11-14, with the spoken announcer (browser
  speech synthesis, switch in `manifest.ts` under `voice`).
- `src/game/state.ts` was written by the orchestrator in the scaffold
  instead of by a subagent, so that every other module could run against
  real gold, upgrades and fish data from the start.
- While several agents work in parallel, only the orchestrator edits
  HANDOVER.md, `src/types.ts` and `src/main.ts`, to avoid merge conflicts.
  Agents report in their PR description and the orchestrator updates this
  file when it merges. (The fight agent may extend fight-related parts of
  `types.ts` and `manifest.ts`; the assets agent edits the sprite, sound
  and music entries of `manifest.ts`.)

Changes after team feedback during the build (2026-11-14):

- The first hero sprite (a chibi samurai) was rejected as not cool enough
  and replaced with LuizMelo's "Martial Hero" (CC0).
- In the boat the samurai is a simple code-drawn figure meditating while he
  waits for a bite; the detailed fighter is for duels only.
- First tuning pass: more fish per screen (8), larger small fish in fights,
  blocking absorbs 65% instead of 80% so biters matter, longer timers for
  the eel and anglerfish, squid health 550 to 480.

## Known issues and open questions

- The first commit (plan and scaffold) went straight to `main` because an
  empty repo gives pull requests no base. Everything after it goes through
  PRs.
- The round counter and save persist in localStorage; use
  `game.state.reset()` to start over.
- `npm test` prints a large balance table; that is intended.
- Open question for the team: is the stand-in squid acceptable, or should
  it stay a placeholder until a better sprite is found?
