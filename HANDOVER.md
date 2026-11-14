# HANDOVER

Shared source of truth for project status. Read this before starting any
work, and update it in the same commit as the work.

Last updated: 2026-11-14 (session 2: cleanups merged; keyboard, announcer and placeholder fish in progress)

## Current state

- **First playable build is on `main`.** The whole loop works: ocean, hook-up
  cutscene, fight, result, shop, repeat, with saving.
- **Play it online:** https://yurtemre7.github.io/samurai-hook/
  Every push to `main` runs the tests, builds and redeploys
  (`.github/workflows/pages.yml`). Asset paths go through `assetUrl()` in
  `src/core/assets.ts`, so the build works under the `/<repo>/` sub-path.
- How to run: `npm install`, then `npm run dev` and open
  http://localhost:5173. Checks: `npm run typecheck`, `npm test` (49 tests).
  README.md has controls and how to add a fish or swap an asset.
- Keep the working copy on a normal local disk. Inside a cloud drive mount
  (pCloud Drive was tried) `npm install` fails: the drive cannot create
  symlinks or run the build tool's binary.
- Demo shortcuts: F2 (or `?start=demo`) starts with gold and upgrades from
  `demoStart` in the manifest; F4 (or `?start=fresh`) wipes the save.
  Keyboard only; there is no gamepad shortcut.
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

Session 2 (2026-11-14), run by Rhaveen with a Claude orchestrator and
subagents. **Please do not edit the files listed here on another branch until
these land, or the work will collide.** Each pull request updates this file.

| Work | Branch | Files it touches | Why |
|---|---|---|---|
| Keyboard fix | `fix/keyboard-wasd` | `src/input/*`, `Prompt` in `src/types.ts`, the prompt lines in `src/scenes/fight.ts` and `shop.ts`, `tests/input.test.ts` | A player on Chrome on a Mac reported that W A S D did nothing in the fight while the arrow keys and J K L E worked. Cause not confirmed; see Known issues. |
| Recorded announcer | (not pushed yet) | `src/core/audio.ts`, new `src/core/announcer.ts`, `voice` in `src/manifest.ts`, `AudioSys.announce` in `src/types.ts`, announce calls in `cutscene.ts`, `fight.ts`, `result.ts`, new `public/assets/voice/`, `CREDITS.md` | The player found the speech-synthesis announcer robotic. Goes to the team as a pull request for review, because the robot voice was a deliberate joke. Music and other sounds are not changed. |
| Swordfish and anglerfish sprites, glowing lure | (not pushed yet) | `public/assets/fish/`, the two sprite lines in `src/manifest.ts`, the darkness code in `src/scenes/fight.ts`, `CREDITS.md` | Replace the two placeholder fish. The lure glow is visual only. |

Planned next, not started: boat, hook and nigiri sprites; a bundled Japanese
font.

The repository was renamed to `samurai-hook` on 2026-11-15 (issue #19), so
the play link is now https://yurtemre7.github.io/samurai-hook/ and the old
Pages address is a 404. GitHub redirects the old repository URL, but it is
cleaner to run `git remote set-url origin
https://github.com/yurtemre7/samurai-hook.git`. Reload any open game tab.

Open request to the repository owner: a playable preview link on every pull
request (issue #21).

## Pending (in priority order)

1. **Play it as a human, on keyboard and a real controller**, and note what
   feels off. All tuning so far comes from a scripted bot. Rhaveen has no
   controller, so **the controller test needs another teammate**.
2. **Listen to the sounds.** They were picked by file name. Swap any that do
   not fit in the `sounds` block of `src/manifest.ts`; find CC0 files for
   `bite`, `lose`, `hooked`, `uiDeny`.
3. **Missing art:** swordfish and anglerfish are in progress (see above).
   Still to do: boat, hook, nigiri (CC0 or CC-BY only). Kenney.nl blocks
   scripted downloads, but its packs are also on OpenGameArt, where a plain
   download works.
4. **Redraw all nine fish in one style.** The current sprites are tiny (the
   sardine is 14x8 px) and come from three artists. Deferred by Rhaveen until
   the placeholders are finished.
5. **Tuning** in `src/manifest.ts`: run `npm test` to print the balance
   table (bot results per fish and damage level). Known soft spots: early
   fish die in 1 or 2 hits from damage level 6; bite damage does not grow
   with tier; a straight hook drop can miss every fish.
6. Kanji in the shop, banners and gauge rely on a Japanese system font
   (checked on macOS only). Bundling a free font is planned.
7. The "OPEN" ring's full circle still uses an estimated window length
   (`look.vulnTotal` in `src/scenes/fight.ts`); only the remaining time is
   exact. Add `vulnTotal` to the fight state to finish it.
8. Later ideas (docs/DESIGN.md, section 8): equipment with effects, health
   and reel-speed upgrades, parry, a boss, a bestiary. **Electric eel**
   (suggested by Rhaveen, 2026-11-14): the eel charges up with a visible
   crackle, then shocks a circle around itself; back off or dash to avoid it,
   blocking does not help. Not built; the eel stays slippery for now.

Done in session 2 (PR #20, merged): the old items 5, 7, 8 and 9. The result
screen's G-to-RYO swap is gone; the fight texts, cutscene and result timings
and the ocean layout live in `src/manifest.ts` (`text`, `cutscene`, `result`,
`ocean.layout`); `tint` colours only the sprite's own pixels inside
`assets.draw`; `fish.vulnLeft` is part of the fight state. No gameplay number
changed and the bot balance table is identical.

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

Session 2 decisions by Rhaveen (2026-11-14):

- Slippery fish stay harmless, as designed. The pufferfish keeps its stun and
  bounce with no damage; the eel stays slippery (electric eel is a later
  idea); the squid sprite stays as it is.
- The anglerfish's lure should glow through the darkness (visual only).
- Finish the placeholder fish first; redraw the whole roster later.
- The fight music stays. Only the announcer voice is being replaced, and that
  change is for the team to review.
- Pull requests are reviewed by teammates before merging, except
  behaviour-preserving cleanups, documentation and the placeholder-fish
  sprites, which the orchestrator may merge after its own checks.

## Known issues and open questions

- The first commit (plan and scaffold) went straight to `main` because an
  empty repo gives pull requests no base. Everything after it goes through
  PRs.
- The round counter and save persist in localStorage; use
  `game.state.reset()` to start over.
- `npm test` prints a large balance table; that is intended.
- Open question for the team: is the stand-in squid acceptable, or should
  it stay a placeholder until a better sprite is found?
- **W A S D in the fight (reported by Rhaveen, Chrome on a Mac):** A and D
  did not move the samurai while the arrow keys and J K L E worked. Not
  reproduced by the orchestrator. Two unconfirmed causes are both being
  fixed on `fix/keyboard-wasd`: macOS press-and-hold interrupting a held
  letter (the arrows were the only keys the game claimed with
  `preventDefault`), and a non-QWERTY layout. `?debug=keys` on that branch
  shows what the browser reports.
- Pull requests have no automated checks; tests run only on pushes to
  `main`, as part of the deploy.
- Scripted browser checks cannot watch fights in motion when the browser
  pane is hidden, because a hidden page pauses its game loop. PR #20 was
  checked by tests, the balance table and still screenshots only.
