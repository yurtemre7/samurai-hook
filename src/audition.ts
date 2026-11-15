// Dev-only audition page (audition.html). Not imported by the game, so it is
// not in the production build. It uses the game's own audio code (createAudio)
// and manifest, so what you hear here is what the game would play.
//
// One voice speaks every line: pick a voice (pack), a treatment for all lines,
// and optionally a different treatment for the Fight line only.
import { createAudio } from './core/audio';
import { NEUTRAL_FX, resolveFx, type AnnounceRequest, type FxChoice, type VoiceFx } from './core/announcer';
import { cutscene, music, sounds, text, voice } from './manifest';

const audio = createAudio(sounds, music, voice);
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => audio.unlock(), { capture: true });

const ROBOT = 'robot';
const CUSTOM = 'custom';
const SAME = 'same';

/** What each voice actually says per line, and alternate clips to try.
 *  Taken from the packs' file names; nobody has listened to them. */
interface PackInfo {
  label: string;
  words: Record<string, string>;
  alternates?: Record<string, Record<string, string>>; // line key -> words -> clip path
}
const PACKS: Record<string, PackInfo> = {
  fighter: {
    label: 'Kenney Fighter (male, soft)',
    words: { round: 'Ready', fight: 'Fight', win: 'You win', perfect: 'Flawless victory', timeout: 'Time', ko: 'You lose' },
  },
  alba: {
    label: 'Alba MacKenna (raw)',
    words: { round: 'Ready', fight: 'Fight', win: 'You win', perfect: 'Victory', timeout: 'Time', ko: 'You lose' },
    alternates: { perfect: { Great: 'assets/voice/alba/perfect-great.wav' }, ko: { Defeat: 'assets/voice/alba/ko-defeat.wav' } },
  },
  albaFx: {
    label: 'Alba MacKenna (her FX)',
    words: { round: 'Ready', fight: 'Fight', win: 'You win', perfect: 'Victory', timeout: 'Time', ko: 'You lose' },
    alternates: { perfect: { Great: 'assets/voice/albaFx/perfect-great.wav' }, ko: { Defeat: 'assets/voice/albaFx/ko-defeat.wav' } },
  },
  aimee: {
    label: 'Aimee Smith (female)',
    words: { round: 'Ready', fight: 'Fight', win: 'K.O.', perfect: 'Perfect', timeout: 'Game set', ko: 'Game over' },
    alternates: { timeout: { Game: 'assets/voice/aimee/timeout-game.wav' } },
  },
  pack1: {
    label: 'Kenney Voiceover #1 (says "Go" instead of "Fight")',
    words: { round: 'Round', fight: 'Go', win: 'You win', perfect: 'Congratulations', timeout: 'Time over', ko: 'You lose' },
  },
};
const packNames = Object.keys(voice.packs);
const packInfo = (p: string): PackInfo => PACKS[p] ?? { label: p, words: {} };

interface Line { id: string; title: string; line: string; req: AnnounceRequest }
const round = (n: number): Line => ({ id: `round${n}`, title: `Round ${n}`, line: `Round ${n}! Iwashi!`, req: { key: 'round', round: n, fish: 'Iwashi' } });
const FIGHT: Line = { id: 'fight', title: 'Fight', line: text.announce.fight, req: { key: 'fight' } };
const WIN: Line = { id: 'win', title: 'Win', line: text.announce.win, req: { key: 'win' } };
const LOSE: Line = { id: 'ko', title: 'Lose (bitten)', line: text.announce.ko, req: { key: 'ko' } };
const lines: Line[] = [
  round(1), round(2), round(7), FIGHT, WIN,
  { id: 'perfect', title: 'Perfect', line: text.announce.perfect, req: { key: 'perfect' } },
  { id: 'timeout', title: 'Time', line: text.announce.timeout, req: { key: 'timeout' } },
  LOSE,
];

/** Seconds between the "Round N" line and "Fight" in the game (the cutscene). */
const ROUND_TO_FIGHT = cutscene.duration;
const FIGHT_TO_END = 3.5;

// ---- current selection ----
const presetNames = Object.keys(voice.presets);
const sel = {
  pack: voice.pack as string,
  preset: (typeof voice.preset === 'string' ? voice.preset : CUSTOM) as string,
  fight: (typeof voice.linePresets.fight === 'string' ? voice.linePresets.fight : SAME) as string,
  alt: {} as Record<string, string>, // line key -> alternate clip path (for the current pack)
};
let custom: VoiceFx = resolveFx(voice.presets, 'demon');

const choice = (name: string): FxChoice => (name === CUSTOM ? custom : name);
function currentClips(): Record<string, string> {
  return { ...voice.packs[sel.pack], ...sel.alt };
}
function currentLinePresets(): Record<string, FxChoice> {
  return sel.fight === SAME ? {} : { fight: choice(sel.fight) };
}
/** What this voice says for a line (from file names). */
function wordsFor(l: Line): string {
  if (sel.pack === ROBOT) return l.line;
  const clips = voice.packs[sel.pack];
  const key = l.req.key;
  if (key === 'round') {
    if (clips[`round${l.req.round}`]) return `Round ${l.req.round}`;
    return clips.round ? `${packInfo(sel.pack).words.round ?? 'generic'} (no "Round ${l.req.round}" recorded)` : 'robot voice (no clip)';
  }
  const alt = sel.alt[key];
  if (alt) {
    const hit = Object.entries(packInfo(sel.pack).alternates?.[key] ?? {}).find(([, path]) => path === alt);
    if (hit) return hit[0];
  }
  return packInfo(sel.pack).words[key] ?? key;
}

// ---- playback: always through audio.announce, the game's own path ----
let timers: number[] = [];
function cancelPending(): void { for (const t of timers) clearTimeout(t); timers = []; }
function later(seconds: number, fn: () => void): void { timers.push(window.setTimeout(fn, seconds * 1000)); }

function say(l: Line): void {
  if (sel.pack === ROBOT) {
    audio.setVoice({ clips: {}, preset: 'clean', linePresets: {} });
    audio.announce(l.line); // no clip request: speech synthesis, as before
    return;
  }
  audio.setVoice({ clips: currentClips(), preset: choice(sel.preset), linePresets: currentLinePresets() });
  audio.announce(l.line, l.req);
}
function click(fn: () => void): () => void {
  return () => { audio.unlock(); cancelPending(); fn(); };
}

// ---- small DOM helpers ----
const $ = (id: string) => document.getElementById(id)!;
function button(label: string, fn: () => void, cls = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label; b.className = cls; b.onclick = fn;
  return b;
}
/** A row of toggle buttons; exactly one is pressed. */
function toggles(host: HTMLElement, options: [value: string, label: string][], get: () => string, set: (v: string) => void): () => void {
  const buttons = options.map(([value, label]) => {
    const b = button(label, () => { set(value); render(); }, 'toggle');
    b.dataset.value = value;
    host.append(b);
    return b;
  });
  return () => { for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.value === get())); };
}

// ---- build the page ----
const updaters: (() => void)[] = [];

updaters.push(toggles($('voices'),
  [...packNames.map((p): [string, string] => [p, packInfo(p).label]), [ROBOT, 'Old robot voice (speech synthesis)']],
  () => sel.pack, (v) => { sel.pack = v; sel.alt = {}; }));

const treatmentOptions = [...presetNames.map((n): [string, string] => [n, n]), [CUSTOM, 'custom (sliders below)'] as [string, string]];
updaters.push(toggles($('treatments'), treatmentOptions, () => sel.preset, (v) => { sel.preset = v; }));
updaters.push(toggles($('fightTreatments'), [[SAME, 'same as the rest'], ...treatmentOptions], () => sel.fight, (v) => { sel.fight = v; }));

function renderLines(): void {
  const host = $('lines');
  host.textContent = '';
  for (const l of lines) {
    const row = document.createElement('div'); row.className = 'line';
    const name = document.createElement('span'); name.className = 'name'; name.textContent = l.title;
    row.append(name, button(`"${wordsFor(l)}"`, click(() => say(l)), 'big'));
    const alts = sel.pack === ROBOT ? undefined : packInfo(sel.pack).alternates?.[l.req.key];
    if (alts) {
      const key = l.req.key;
      const span = document.createElement('span'); span.className = 'alts'; span.textContent = 'use instead: ';
      const pick = (path: string | undefined) => click(() => {
        if (path) sel.alt[key] = path; else delete sel.alt[key];
        render();
        say(l);
      });
      const std = button(`"${packInfo(sel.pack).words[key]}"`, pick(undefined), 'toggle');
      std.setAttribute('aria-pressed', String(!sel.alt[key]));
      span.append(std);
      for (const [words, path] of Object.entries(alts)) {
        const b = button(`"${words}"`, pick(path), 'toggle');
        b.setAttribute('aria-pressed', String(sel.alt[key] === path));
        span.append(b);
      }
      row.append(span);
    }
    host.append(row);
  }
}

function playFight(end: Line): void {
  say(round(1));
  later(ROUND_TO_FIGHT, () => say(FIGHT));
  later(ROUND_TO_FIGHT + FIGHT_TO_END, () => say(end));
}
$('whole').append(
  button(`Play a whole fight: Round 1, Fight, Win`, click(() => playFight(WIN)), 'big primary'),
  button(`Play a whole fight: Round 1, Fight, Lose`, click(() => playFight(LOSE)), 'big primary'),
);
$('wholeNote').textContent = `Round 1, then Fight after ${ROUND_TO_FIGHT} s (as in the game), then the result after ${FIGHT_TO_END} s.`;

// ---- custom sliders ----
const fxKeys: { key: keyof VoiceFx; min: number; max: number; step: number; hint: string }[] = [
  { key: 'rate', min: 0.5, max: 1.2, step: 0.01, hint: 'lower = deeper and slower' },
  { key: 'drive', min: 0, max: 1, step: 0.01, hint: 'distortion / growl' },
  { key: 'lowBoost', min: 0, max: 18, step: 0.5, hint: 'bass, dB' },
  { key: 'presence', min: 0, max: 12, step: 0.5, hint: 'bite at 3 kHz, dB' },
  { key: 'highCut', min: 1000, max: 20000, step: 100, hint: 'lower = more muffled' },
  { key: 'gain', min: 0, max: 18, step: 0.5, hint: 'louder into the limiter, dB' },
  { key: 'reverb', min: 0, max: 1, step: 0.01, hint: 'hall amount' },
  { key: 'reverbSeconds', min: 0.2, max: 4, step: 0.1, hint: 'hall size' },
  { key: 'echo', min: 0, max: 1, step: 0.01, hint: 'echo amount' },
  { key: 'echoSeconds', min: 0.05, max: 0.6, step: 0.01, hint: 'echo delay' },
  { key: 'echoFeedback', min: 0, max: 0.85, step: 0.01, hint: '0 = one slap, more = repeats' },
  { key: 'layerGain', min: 0, max: 1, step: 0.01, hint: 'second, lower voice: level' },
  { key: 'layerRate', min: 0.4, max: 1, step: 0.01, hint: 'second voice: how much lower' },
];
const inputs = new Map<keyof VoiceFx, { range: HTMLInputElement; out: HTMLSpanElement }>();
for (const f of fxKeys) {
  const label = document.createElement('label'); label.textContent = f.key;
  const range = document.createElement('input');
  range.type = 'range'; range.min = String(f.min); range.max = String(f.max); range.step = String(f.step);
  const out = document.createElement('span');
  const hint = document.createElement('small'); hint.textContent = f.hint;
  range.oninput = () => { custom = { ...custom, [f.key]: Number(range.value) }; render(); };
  $('sliders').append(label, range, out, hint);
  inputs.set(f.key, { range, out });
}
const startSel = $('customPreset') as HTMLSelectElement;
for (const n of presetNames) startSel.add(new Option(n, n));
startSel.value = 'demon';
startSel.onchange = () => { custom = resolveFx(voice.presets, startSel.value); render(); };

// ---- readout ----
function fxText(name: string): string {
  if (name !== CUSTOM) return `'${name}'`;
  const diff: Partial<VoiceFx> = {};
  for (const k of Object.keys(NEUTRAL_FX) as (keyof VoiceFx)[]) if (custom[k] !== NEUTRAL_FX[k]) diff[k] = custom[k];
  return JSON.stringify(diff);
}
function readoutText(): string {
  if (sel.pack === ROBOT) return 'Old robot voice: no recorded clips (speech synthesis for every line).';
  const out = [
    `pack: '${sel.pack}',   // ${packInfo(sel.pack).label}`,
    `preset: ${fxText(sel.preset)},`,
    `linePresets: ${sel.fight === SAME ? '{}' : `{ fight: ${fxText(sel.fight)} }`},`,
  ];
  const alts = Object.entries(sel.alt);
  out.push(alts.length ? `alternate clips: ${alts.map(([k, p]) => `${k} -> ${p}`).join(', ')}` : 'alternate clips: none');
  return out.join('\n');
}
$('copy').onclick = () => {
  const done = (m: string) => { $('copied').textContent = m; };
  const ta = $('readout') as HTMLTextAreaElement;
  navigator.clipboard.writeText(ta.value).then(() => done('copied'), () => { ta.select(); done('select and copy manually'); });
};

function render(): void {
  for (const u of updaters) u();
  const robot = sel.pack === ROBOT;
  for (const id of ['treatments', 'fightTreatments']) {
    for (const b of $(id).querySelectorAll('button')) b.disabled = robot;
    $(id).classList.toggle('off', robot);
  }
  renderLines();
  for (const f of fxKeys) {
    const i = inputs.get(f.key)!;
    i.range.value = String(custom[f.key]);
    i.out.textContent = String(custom[f.key]) + (f.key === 'highCut' && custom.highCut >= 20000 ? ' (off)' : '');
  }
  ($('readout') as HTMLTextAreaElement).value = readoutText();
  $('copied').textContent = '';
}
render();
