# Credits

All third-party assets are CC0 1.0 (public domain). Licences were read on each
asset's own OpenGameArt page (the "License(s)" field) on 2026-11-14; the Kenney
RPG sounds pack also ships a `license.txt` stating CC0. Credit is not required
but given here anyway. Sprites were cropped, scaled and cut into strips; audio
was copied unchanged except `music/ocean.mp3` (trimmed to 60 s, fades, MP3 64 kbps).

| File(s) | What | Source | Author | Licence | Checked |
|---|---|---|---|---|---|
| `public/assets/fish/sardine.png`, `mackerel.png`, `piranha.png`, `eel.png`, `shark.png` | Pixel fish: Clupea pallasii (sardine), Caranx ruber (mackerel stand-in), Pygocentrus nattereri (piranha), Gymnothorax javanicus (eel), Carcharias taurus (shark) | https://opengameart.org/content/fish-db32 | ARoachIFoundOnMyPillow | CC0 | 2026-11-14 |
| `public/assets/samurai/idle.png`, `walk.png`, `quick.png`, `heavy.png`, `block.png`, `hurt.png` | Samurai character: Idle, Run, Attack1 (no effect), Attack2 (no effect), Back (used as block pose), Hurt | https://opengameart.org/content/samurai-character | Segel | CC0 | 2026-11-14 |
| `public/assets/sfx/slash.ogg`, `heavy.ogg` (sword.6, sword.10) | Sword swings | https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes | StarNinjas | CC0 | 2026-11-14 |
| `public/assets/sfx/block.ogg` (sword_clash.4) | Sword clash | https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes | StarNinjas | CC0 | 2026-11-14 |
| `public/assets/sfx/dash.wav` (swish-13), `slip.wav` (swish-12) | Short swishes | https://opengameart.org/content/swishes-sound-pack | artisticdude | CC0 | 2026-11-14 |
| `public/assets/sfx/hit.ogg` (hit_01), `gong.ogg` (gong_02), `ko.ogg` (slam_05), `ui_move.ogg` (switch_01), `tell.ogg` (bell_01) | Impact, gong, heavy slam, switch click, bell | https://opengameart.org/content/100-cc0-sfx | rubberduck | CC0 | 2026-11-14 |
| `public/assets/sfx/buy.ogg` (item_coins_01) | Coins | https://opengameart.org/content/80-cc0-rpg-sfx | rubberduck | CC0 | 2026-11-14 |
| `public/assets/sfx/splash.ogg` (splash_02) | Water splash | https://opengameart.org/content/40-cc0-water-splash-slime-sfx | rubberduck | CC0 | 2026-11-14 |
| `public/assets/sfx/coin.wav` (coin3) | Coin | https://opengameart.org/content/10-8bit-coin-sounds | Luke.RUSTLTD | CC0 | 2026-11-14 |
| `public/assets/sfx/ui_confirm.ogg` (metalClick) | Metal click | https://opengameart.org/content/50-rpg-sound-effects | Kenney (kenney.nl) | CC0 | 2026-11-14 |
| `public/assets/music/fight.ogg` (8BitBattleLoop) | Fight loop | https://opengameart.org/content/8-bit-battle-loop | Wolfgang_ | CC0 | 2026-11-14 |
| `public/assets/music/ocean.mp3` (first 60 s of hot_spring_town.ogg) | Calm ocean track | https://opengameart.org/content/hot-springs-town | Kistol | CC0 | 2026-11-14 |

## Gaps (still code-drawn or synthesised placeholders)

Sprites
- `fish.pufferfish`: the only pufferfish in the fish pack (Arothron hispidus) reads as a plain orange fish; not used.
- `fish.swordfish`: no swordfish in any confirmed CC0 pack (the needlefish and barracuda are not swordfish).
- `fish.anglerfish`, `fish.squid`: none found in a confirmed CC0 pack.
- `boat`, `hook`, `nigiri`: not found. Kenney's Pirate Pack is CC0 but kenney.nl refused scripted downloads (HTTP 403), so it was not fetched.
- `samuraiSit` reuses the idle frame (no seated pose in the pack). `samuraiBlock` uses the "Back" frame; the pack has no dedicated block pose.

Sounds (synthesised fallbacks stay in use)
- `bite`, `uiDeny`, `lose`, `hooked`: no confident match found, and files could not be auditioned. Not guessed.

Notes
- Fish art faces left; samurai art faces left (set via `facing: 'left'`).
- `mackerel` uses a jack (Caranx ruber), the closest silhouette in the pack.
- The ocean track is a cut from a longer piece, so its loop point has a fade rather than a seamless join. All audio was chosen by file name and length, not by ear; please listen to the sounds once.
