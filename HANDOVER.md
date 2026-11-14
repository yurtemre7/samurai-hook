# HANDOVER

Shared source of truth for project status. Read this before starting any
work, and update it in the same commit as the work.

Last updated: 2026-11-14 (restyle and GitHub Pages)

## Current state

- **First playable build is on `main`.** The whole loop works: ocean, hook-up
  cutscene, fight, result, shop, repeat, with saving.
- **Play it online:** https://yurtemre7.github.io/team-1-game-samurai-hook/
  Every push to `main` runs the tests, builds and redeploys
  (`.github/workflows/pages.yml`). Asset paths go through `assetUrl()` in
  `src/core/assets.ts`, so the build works under the `/<repo>/` sub-path.
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
- Still code-drawn: swordfish, anglerfish, nigiri (plain placeholders), and
  the boat and hook (deliberately detailed code-drawn pixel art: an old
  wooden wasen with lantern, basket and patched planks). All can be replaced
  by a sprite through the manifest.
- The samurai in the boat is the same fight character (idle strip, legs
  hidden behind the gunwale, holding a bamboo rod).
- All scenes share one look: the sunset sky, sun, clouds and waves are drawn
  by `src/ui/backdrop.ts` for both the ocean and the fight stage; the shop,
  cutscene and result screens use `src/scenes/screens/paint.ts`.
- Fish have Japanese names (Iwashi, Saba, Pirania, Unagi, Fugu, Kajiki,
  Anko, Hojiro, Daioika); the English species is in each fish's `title`.
  Gold is shown as RYO in the shop and result screens.
- Still synthesised blips: `bite`, `lose`, `hooked`, `uiDeny`.

### Verified in a browser on 2026-11-14 (by the orchestrator, scripted input)

- Keyboard: drop hook, hook a sardine, skip cutscene, win, gold +5, back to
  the ocean. Timeout loss against a sardine with no input: no gold.
- Simulated gamepad (a fake pad behind `navigator.getGamepads`): win against
  a piranha (biter) and a mackerel, knockout loss against the shark, open the
  shop, buy the blade upgrade, refused purchase when short of gold, back to
  the ocean. Prompts switched to A / Y / stick glyphs.
- No console errors in any of the above.
- After the restyle (same day): ocean, shop, cutscene, win screen and one
  hook-up into a fight were re-checked by the orchestrator on `main`, and the
  live Pages site was loaded with no console errors. The full win / loss /
  gamepad script above was not re-run after the restyle.
- A team member reported playing the first build and that it worked; whether
  that included a real controller is not confirmed.
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
5. `text.win.sold` in the manifest still ends in "G" (now fixed to RYO; the result-screen swap is harmless and can go)
   swaps it to RYO when drawing. Change the string and drop the workaround.

6. Kanji in the shop, banners and gauge rely on a Japanese system font
   (checked on macOS only). Consider bundling a free font.
7. **Move scene constants into the manifest:** the four texts at the top of
   `src/scenes/fight.ts` (`SAMURAI_SAFE_SUB`, `DODGED_TEXT`, `PUFF_TEXT`,
   `SAMURAI_LABEL`), cutscene and result timings, and the ocean layout
   constants at the top of `src/scenes/ocean.ts`.
8. `tint` in `src/core/assets.ts` colours the sprite's whole rectangle, not
   just its pixels. The fight scene works around it with a scratch canvas;
   fix it in `assets.ts` and remove the workaround.
9. Add `vulnLeft` to the fight state so the "OPEN" ring is exact instead of
   estimated from tuning.
10. Later ideas (docs/DESIGN.md, section 8): equipment with effects, health
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
- Second round of feedback: the boat samurai must be the same character as
  the fighter (this replaced the earlier simple meditating figure), the boat
  must look ancient and wooden, the fishing and fighting scenes must share
  one look, and the shop and fish should be more Japanese. All done in PRs
  10, 12 and 13.
- The team asked for GitHub Pages hosting; the orchestrator enabled Pages
  (build type: GitHub Actions) on the repository.
- Third round of feedback: the shop is navigated left/right (the boards hang
  side by side), and the sword hitbox now matches the slash drawn in the
  sprite: quick reach 110 to 185, heavy 150 to 215, strike height 70 to 150
  (`fight.samurai` and `fight.fish.hitHeight` in the manifest). This makes
  every fight easier: the test bot now beats all nine fish at damage level 0,
  so fish health or timers probably need raising in the next tuning pass.
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
