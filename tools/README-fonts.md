# Bundled kanji font

The kanji and kana drawn by the game use a subset of a free (SIL OFL) font,
so they look the same on every machine. The active face is `fonts.kanji` in
`src/manifest.ts` (Kaisei Tokumin Bold, chosen 2026-11-15; see HANDOVER.md).

- `tools/font-chars.txt` is the one list of characters kept in the subset.
- `tools/font-chars.py` rebuilds that list from every kanji found in `src/`
  and `index.html`, plus the kana, digits and a few marks.
- `tools/subset-fonts.sh` subsets the full fonts into `public/assets/fonts/*.woff2`.

## Re-run after adding a new kanji to the game

The full font files are not in the repository. Download them again (OFL
fonts from https://github.com/google/fonts/tree/main/ofl, the exact files
are listed in CREDITS.md) into `candidates/fonts/<dir>/`, then, from the
project root:

```sh
python3 -m venv candidates/venv
candidates/venv/bin/pip install fonttools brotli
python3 tools/font-chars.py
sh tools/subset-fonts.sh
```

The core of the subset command is:

```sh
candidates/venv/bin/pyftsubset candidates/fonts/kaiseitokumin/KaiseiTokumin-Bold.ttf \
  --text-file=tools/font-chars.txt --flavor=woff2 --layout-features= \
  --no-hinting --drop-tables+=BASE,vhea,vmtx,gasp,GSUB \
  --output-file=public/assets/fonts/kaisei-tokumin.woff2
```

The subset is about 44 KB. To change the face, download another OFL font the
same way, add it to the loop in `tools/subset-fonts.sh` and to `fonts.files`
in the manifest, ship its `OFL.txt` next to it, and add a CREDITS row.
