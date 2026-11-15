// Dev-only audition page (audition.html). Not imported by the game, so it is
// not in the production build. It uses the game's own audio code (createAudio)
// and manifest, so what you hear here is what the game would play.
import { createAudio } from './core/audio';
import { NEUTRAL_FX, resolveFx, type AnnounceRequest, type FxChoice, type VoiceFx } from './core/announcer';
import { cutscene, music, sounds, text, voice } from './manifest';

const audio = createAudio(sounds, music, voice);
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => audio.unlock(), { capture: true });

interface Line { label: string; line: string; req: AnnounceRequest }
const ROUND1: Line = { label: 'Round 1', line: 'Round 1! Iwashi!', req: { key: 'round', round: 1, fish: 'Iwashi' } };
const FIGHT: Line = { label: 'Fight', line: text.announce.fight, req: { key: 'fight' } };
const WIN: Line = { label: 'Win / K.O.', line: text.announce.win, req: { key: 'win' } };
const lines: Line[] = [
  ROUND1,
  { label: 'Round 7 (past the recorded ones)', line: 'Round 7! Iwashi!', req: { key: 'round', round: 7, fish: 'Iwashi' } },
  FIGHT,
  WIN,
  { label: 'Perfect', line: text.announce.perfect, req: { key: 'perfect' } },
  { label: 'Time', line: text.announce.timeout, req: { key: 'timeout' } },
  { label: 'Lose (bitten)', line: text.announce.ko, req: { key: 'ko' } },
];

/** Seconds between the "Round N" line and "Fight" in the game (the cutscene). */
const ROUND_TO_FIGHT = cutscene.duration;
const FIGHT_TO_WIN = 3.5;

const presetNames = Object.keys(voice.presets);
const packNames = Object.keys(voice.packs);
const PACK_LABEL: Record<string, string> = { fighter: 'Kenney Fighter', pack1: 'Kenney Voiceover #1 (male)' };
const packLabel = (p: string) => PACK_LABEL[p] ?? p;

// ---- playback: always through audio.announce, the game's own path ----
let timers: number[] = [];
function cancelPending(): void { for (const t of timers) clearTimeout(t); timers = []; }
function later(seconds: number, fn: () => void): void { timers.push(window.setTimeout(fn, seconds * 1000)); }

/** Exactly what the game plays now (manifest pack, preset and linePresets). */
function sayAsGame(l: Line): void {
  audio.setVoice({ clips: voice.clips, preset: voice.preset, linePresets: voice.linePresets });
  audio.announce(l.line, l.req);
}
/** A line from a given clip set with one treatment for everything. */
function sayWith(l: Line, clips: Record<string, string>, fx: FxChoice): void {
  audio.setVoice({ clips, preset: fx, linePresets: {} });
  audio.announce(l.line, l.req);
}
function sayRobot(l: Line): void {
  audio.setVoice({ clips: {}, preset: 'clean', linePresets: {} });
  audio.announce(l.line); // no clip request: speech synthesis
}
function click(fn: () => void): () => void {
  return () => { audio.unlock(); cancelPending(); fn(); };
}

function button(label: string, fn: () => void, cls = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label; b.className = cls; b.onclick = click(fn);
  return b;
}
const $ = (id: string) => document.getElementById(id)!;

// ---- Section 1: chosen so far ----
{
  const box = $('chosen');
  for (const l of lines) box.append(button(l.label, () => sayAsGame(l)));
  $('chosenRound').append(button(`Play a full round (Round 1, ${ROUND_TO_FIGHT} s, Fight, ${FIGHT_TO_WIN} s, Win)`, () => {
    sayAsGame(ROUND1);
    later(ROUND_TO_FIGHT, () => sayAsGame(FIGHT));
    later(ROUND_TO_FIGHT + FIGHT_TO_WIN, () => sayAsGame(WIN));
  }, 'big'));
  const lp = Object.entries(voice.linePresets).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : 'custom'}`).join(', ');
  $('chosenNote').textContent = `Pack: ${packLabel(voice.pack)}. All lines: ${String(voice.preset)}. Overrides: ${lp || 'none'}.`;
}

// ---- Section 2: pick the Fight voice ----
interface FightSource { label: string; note: string; clip: string }
const fightSources: FightSource[] = [
  { label: 'Kenney Fighter: "Fight"', note: 'the chosen pack', clip: voice.packs.fighter.fight },
  { label: 'Kenney Voiceover #1: "Go"', note: 'a different word', clip: voice.packs.pack1.fight },
  ...Object.entries(voice.fightCandidates).map(([label, clip]) => ({ label: `${label}: "Fight"`, note: 'another voice (CC-BY)', clip })),
];
const FIGHT_ORDER = ['demon', 'demonPlus', 'hype', 'roar', 'titan', 'stadium', 'deep', 'clean'];
const fightTreatments = [...FIGHT_ORDER.filter((n) => n in voice.presets), ...presetNames.filter((n) => !FIGHT_ORDER.includes(n))];

function playFight(src: FightSource, fx: FxChoice): void { sayWith(FIGHT, { fight: src.clip }, fx); }
function playRoundThenFight(src: FightSource, fx: FxChoice): void {
  sayWith(ROUND1, voice.packs.fighter, voice.preset);
  later(ROUND_TO_FIGHT, () => playFight(src, fx));
}
{
  const table = document.createElement('table');
  const head = table.insertRow();
  const c = document.createElement('th'); c.textContent = 'Treatment'; head.append(c);
  for (const s of fightSources) {
    const th = document.createElement('th');
    th.innerHTML = '';
    th.append(s.label, document.createElement('br'));
    const small = document.createElement('small'); small.textContent = s.note; th.append(small);
    head.append(th);
  }
  for (const name of fightTreatments) {
    const tr = table.insertRow();
    const th = document.createElement('th'); th.className = 'row'; th.textContent = name; tr.append(th);
    fightSources.forEach((s, i) => {
      const td = tr.insertCell();
      if (i === 0) td.className = 'main';
      td.append(button(`FIGHT (${name})`, () => playFight(s, name), 'big'), button('Round 1 then this', () => playRoundThenFight(s, name)));
    });
  }
  $('fightPick').append(table);
}

// ---- Section 3: custom sliders (apply to the Fight line) ----
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
let custom: VoiceFx = resolveFx(voice.presets, 'demon');
let customSource = fightSources[0];

const readout = $('readout') as HTMLTextAreaElement;
const inputs = new Map<keyof VoiceFx, { range: HTMLInputElement; out: HTMLSpanElement }>();
for (const f of fxKeys) {
  const label = document.createElement('label'); label.textContent = f.key; label.title = f.hint;
  const range = document.createElement('input');
  range.type = 'range'; range.min = String(f.min); range.max = String(f.max); range.step = String(f.step);
  const out = document.createElement('span');
  const hint = document.createElement('small'); hint.textContent = f.hint;
  range.oninput = () => { custom = { ...custom, [f.key]: Number(range.value) }; refresh(); };
  $('sliders').append(label, range, out, hint);
  inputs.set(f.key, { range, out });
}
function refresh(): void {
  for (const f of fxKeys) {
    const i = inputs.get(f.key)!;
    i.range.value = String(custom[f.key]);
    i.out.textContent = String(custom[f.key]) + (f.key === 'highCut' && custom.highCut >= 20000 ? ' (off)' : '');
  }
  // Only the values that differ from neutral, as they would go in the manifest.
  const diff: Partial<VoiceFx> = {};
  for (const k of Object.keys(NEUTRAL_FX) as (keyof VoiceFx)[]) if (custom[k] !== NEUTRAL_FX[k]) diff[k] = custom[k];
  readout.value = `// custom Fight treatment\n// clip: ${customSource.label} (${customSource.clip})\n`
    + `linePresets: { fight: ${JSON.stringify(diff)} },`;
}
const srcSel = $('customSource') as HTMLSelectElement;
fightSources.forEach((s, i) => srcSel.add(new Option(s.label, String(i))));
srcSel.onchange = () => { customSource = fightSources[Number(srcSel.value)]; refresh(); };
const presetSel = $('customPreset') as HTMLSelectElement;
for (const n of fightTreatments) presetSel.add(new Option(n, n));
presetSel.onchange = () => { custom = resolveFx(voice.presets, presetSel.value); refresh(); };
$('customPlay').append(
  button('FIGHT (custom)', () => playFight(customSource, custom), 'big'),
  button('Round 1 then this', () => playRoundThenFight(customSource, custom)),
);
$('copy').onclick = () => {
  const done = (m: string) => { $('copied').textContent = m; };
  navigator.clipboard.writeText(readout.value).then(() => done('copied'), () => { readout.select(); done('select and copy manually'); });
};
refresh();

// ---- Full grid (collapsed) ----
{
  const table = document.createElement('table');
  const head1 = table.insertRow();
  const head2 = table.insertRow();
  const corner = document.createElement('th'); corner.rowSpan = 2; corner.textContent = 'Line'; head1.append(corner);
  const robotTh = document.createElement('th'); robotTh.rowSpan = 2; robotTh.textContent = 'Old robot voice'; head1.append(robotTh);
  for (const p of packNames) {
    const th = document.createElement('th'); th.className = 'pack'; th.colSpan = presetNames.length; th.textContent = packLabel(p); head1.append(th);
    for (const n of presetNames) { const h = document.createElement('th'); h.textContent = n; head2.append(h); }
  }
  for (const l of lines) {
    const tr = table.insertRow();
    const th = document.createElement('th'); th.className = 'row'; th.textContent = l.label; tr.append(th);
    tr.insertCell().append(button('play', () => sayRobot(l)));
    for (const p of packNames) for (const n of presetNames) tr.insertCell().append(button('play', () => sayWith(l, voice.packs[p], n)));
  }
  $('grid').append(table);
}
