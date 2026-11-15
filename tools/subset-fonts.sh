#!/bin/sh
# Subsets the kanji font in candidates/fonts/ to the characters in
# tools/font-chars.txt and writes WOFF2 files to public/assets/fonts/.
# Run from the project root. See tools/README-fonts.md.
set -e
SUBSET=candidates/venv/bin/pyftsubset
OUT=public/assets/fonts
for pair in \
  "kaiseitokumin/KaiseiTokumin-Bold.ttf kaisei-tokumin"; do
  set -- $pair
  $SUBSET "candidates/fonts/$1" --text-file=tools/font-chars.txt \
    --flavor=woff2 --layout-features= --no-hinting --drop-tables+=BASE,vhea,vmtx,gasp,GSUB \
    --output-file="$OUT/$2.woff2"
done
ls -l $OUT
