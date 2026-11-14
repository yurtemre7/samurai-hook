# Credits

All third-party assets are CC0 1.0 (public domain) except `fish/pufferfish.png` (CC-BY 3.0, credit below). Licences were read on each
asset's own OpenGameArt page (the "License(s)" field) on 2026-11-14; the Kenney
RPG sounds pack also ships a `license.txt` stating CC0. Credit is not required
but given here anyway. Sprites were cropped, scaled and cut into strips; audio
was copied unchanged except `music/ocean.mp3` (trimmed to 60 s, fades, MP3 64 kbps).

| File(s) | What | Source | Author | Licence | Checked |
|---|---|---|---|---|---|
| `public/assets/fish/sardine.png`, `mackerel.png`, `piranha.png`, `eel.png`, `shark.png` | Pixel fish: Clupea pallasii (sardine), Caranx ruber (mackerel stand-in), Pygocentrus nattereri (piranha), Gymnothorax javanicus (eel), Carcharias taurus (shark) | https://opengameart.org/content/fish-db32 | ARoachIFoundOnMyPillow | CC0 | 2026-11-14 |
| `public/assets/samurai/idle.png`, `walk.png`, `quick.png`, `heavy.png`, `block.png`, `hurt.png` | Samurai (ronin in straw hat, red scarf): Idle, Run, Attack1, Attack2 (both with baked slash arcs), Attack2 frame 3 (used as guard pose), Take Hit. Frames cropped to a common 190x72 box, 1x pixels | https://luizmelo.itch.io/martial-hero (zip contains License.txt: CC-0) | LuizMelo | CC0 | 2026-11-14 |
| `public/assets/fish/squid.png` (newblue.png from Squids.zip, cropped) | Cartoony blue squid, used as the giant squid (cute, not menacing) | https://opengameart.org/content/cartoony-squids | Shozuki | CC0 | 2026-11-14 |
| `public/assets/fish/pufferfish.png` (spr_puffi_20.png, cropped) | 32x32 pixel pufferfish. Offered as CC-BY 3.0 or CC-BY-SA 3.0; used under CC-BY 3.0, credit required: "Pufferfish by TeamAlpha, OpenGameArt" | https://opengameart.org/content/32x32-pixel-pufferfish | TeamAlpha | CC-BY 3.0 | 2026-11-14 |
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

### DRAFT, pending the owner's choice (option B: original art)

Not third-party assets. Drawn by `tools/fish-sprites.mjs` in the style of the
Fish DB32 sprites (DB32 colours, 1 px black outline, facing left, shown at 2x).
Remove these rows if found art is chosen instead.

| File(s) | What | Source | Author | Licence | Checked |
|---|---|---|---|---|---|
| `public/assets/fish/swordfish.png` | 75x28 pixel swordfish (Kajiki) | `tools/fish-sprites.mjs` | original, made for SamuraiHook | same as the project | 2026-11-15 |
| `public/assets/fish/anglerfish.png` | 55x44 pixel anglerfish (Anko) with lure | `tools/fish-sprites.mjs` | original, made for SamuraiHook | same as the project | 2026-11-15 |

## Gaps (still code-drawn or synthesised placeholders)

Sprites
- `fish.swordfish`: no swordfish in a confirmed CC0/CC-BY pack.
- `fish.anglerfish`: the only OpenGameArt anglerfish (https://opengameart.org/content/anglerfish) is CC-BY-SA, rejected.
- `boat`: the CC0 "Wooden Boat" by Kutejnikov is a top-down view, so it does not fit a side-view scene; not used.
- `hook`: nothing found.
- `nigiri`: 1j01's CC0 "8x8 Sushi Sprites" has a nigiri, but it sits on an opaque, tightly packed sheet at 8x8 px; not extracted cleanly.
- Samurai: no seated pose (`samuraiSit` reuses idle) and no dedicated block pose (frame 3 of Attack2, sword raised).
- Rejected: Segel "samurai character" (previous hero, chibi); OpenGameArt "samurai animated" (chibi, 48px); "Hero swordsman" (red-haired kid, not a samurai); itch "Ronin Hack and Slash" and "Samurai Ossan" not fetched (download needs scripted access which was blocked).

Sounds (synthesised fallbacks stay in use)
- `bite`, `uiDeny`, `lose`, `hooked`: no confident match found, and files could not be auditioned. Not guessed.

Notes
- Fish art faces left; samurai art faces right (`facing: 'right'`); frames are 456x173 on screen, body about 125 px tall.
- `mackerel` uses a jack (Caranx ruber), the closest silhouette in the pack.
- The ocean track is a cut from a longer piece, so its loop point has a fade rather than a seamless join. All audio was chosen by file name and length, not by ear; please listen to the sounds once.
