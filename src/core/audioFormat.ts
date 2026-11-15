/** Ogg Vorbis is not playable on older iOS WebKit (support arrived around iOS 18.4). */
const OGG_PROBE = 'audio/ogg; codecs="vorbis"';

/** Maps a `.ogg` path to its `.m4a` (AAC) twin unless the browser can play Ogg. Other paths pass through. */
export function pickAudioPath(path: string, canPlay: (mime: string) => string): string {
  if (!path.endsWith('.ogg')) return path;
  return canPlay(OGG_PROBE) ? path : `${path.slice(0, -4)}.m4a`;
}

let browserCanPlay: ((mime: string) => string) | null = null;

/** Browser variant: probes `canPlayType` once and reuses it. Without a DOM it keeps `.ogg`. */
export function audioPath(path: string): string {
  if (!browserCanPlay) {
    let probe: HTMLAudioElement | null = null;
    try { probe = typeof document === 'undefined' ? null : document.createElement('audio'); } catch { probe = null; }
    let answer = probe ? probe.canPlayType(OGG_PROBE) : 'maybe';
    // `?audio=aac` forces the iPhone path (AAC twins) on any browser, for testing.
    try { if (new URLSearchParams(location.search).get('audio') === 'aac') answer = ''; } catch { /* no location */ }
    browserCanPlay = () => answer;
  }
  return pickAudioPath(path, browserCanPlay);
}
