"""Rebuilds tools/font-chars.txt: every kanji found in src/ and index.html, plus
the kana syllabaries, digits and a few marks. Run from the project root:
    python3 tools/font-chars.py
"""
import glob
import re

text = ''
for path in glob.glob('src/**/*.ts', recursive=True) + ['index.html']:
    with open(path, encoding='utf8') as f:
        text += f.read()

kanji = ''.join(sorted(set(re.findall(r'[一-鿿]', text))))
hiragana = ''.join(chr(c) for c in range(0x3041, 0x3097))
katakana = ''.join(chr(c) for c in range(0x30A1, 0x30FB))
extra = '0123456789・ー'

with open('tools/font-chars.txt', 'w', encoding='utf8') as f:
    f.write(kanji + hiragana + katakana + extra + '\n')
print(f'{len(kanji)} kanji: {kanji}')
