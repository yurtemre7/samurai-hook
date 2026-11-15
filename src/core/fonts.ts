import { fonts } from '../manifest';
import { assetUrl } from './assets';

/** CSS font-family list for every kanji/kana draw call: the bundled face, then the system stack. */
export const KANJI_FONT = `'${fonts.kanji}', ${fonts.fallback}`;

/**
 * Loads the bundled kanji font so canvas text can use it (canvas does not wait
 * for web fonts). Never rejects and never waits longer than `loadTimeoutMs`:
 * on failure or timeout the system fallback stack is used.
 */
export function loadKanjiFont(): Promise<void> {
  const file = fonts.files[fonts.kanji];
  if (!file || typeof FontFace === 'undefined') return Promise.resolve();
  // A one-weight font is declared for all weights so 'bold' is not faux-bolded.
  const face = new FontFace(fonts.kanji, `url(${assetUrl(file)}) format('woff2')`, { weight: '100 900' });
  const load = face.load().then(() => { document.fonts.add(face); });
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, fonts.loadTimeoutMs));
  return Promise.race([load, timeout]).catch((err: unknown) => {
    console.warn(`[fonts] could not load ${file}; using system font`, err);
  });
}
