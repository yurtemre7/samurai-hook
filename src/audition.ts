// Dev-only audition page (audition.html). Not imported by the game, so it is
// not in the production build. It uses the game's own audio code (createAudio)
// and manifest, so what you hear here is what the game would play.
import { createAudio } from './core/audio';
import { NEUTRAL_FX, resolveFx, type AnnounceRequest, type VoiceFx } from './core/announcer';
import { music, sounds, text, voice } from './manifest';

const audio = createAudio(sounds, music, voice);
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => audio.unlock(), { capture: true });

interface Row { label: string; line: string; req: AnnounceRequest }
const rows: Row[] = [
  { label: 'Round 1', line: 'Round 1! Iwashi!', req: { key: 'round', round: 1, fish: 'Iwashi' } },
  { label: 'Round 7 (past the recorded ones)', line: 'Round 7! Iwashi!', req: { key: 'round', round: 7, fish: 'Iwashi' } },
  { label: 'Fight', line: text.announce.fight, req: { key: 'fight' } },
  { label: 'Win / K.O.', line: text.announce.win, req: { key: 'win' } },
  { label: 'Perfect', line: text.announce.perfect, req: { key: 'perfect' } },
  { label: 'Time', line: text.announce.timeout, req: { key: 'timeout' } },
  { label: 'Lose (bitten)', line: text.announce.ko, req: { key: 'ko' } },
];

const presetNames = Object.keys(voice.presets);
const packNames = Object.keys(voice.packs);
const PACK_LABEL: Record<string, string> = { fighter: 'Kenney Fighter (soft)', pack1: 'Kenney Voiceover #1 (male)' };
const packLabel = (p: string) => PACK_LABEL[p] ?? p;

const fxKeys: { key: keyof VoiceFx; min: number; max: number; step: number }[] = [
  { key: 'rate', min: 0.5, max: 1.2, step: 0.01 },
  { key: 'drive', min: 0, max: 1, step: 0.01 },
  { key: 'lowBoost', min: 0, max: 18, step: 0.5 },
  { key: 'highCut', min: 1000, max: 20000, step: 100 },
  { key: 'reverb', min: 0, max: 1, step: 0.01 },
  { key: 'reverbSeconds', min: 0.2, max: 4, step: 0.1 },
  { key: 'echo', min: 0, max: 1, step: 0.01 },
  { key: 'echoSeconds', min: 0.05, max: 0.6, step: 0.01 },
];

let custom: VoiceFx = { ...NEUTRAL_FX };
let customPack = packNames[0];

function playCell(row: Row, mode: { robot: true } | { pack: string; fx: VoiceFx }): void {
  audio.unlock();
  if ('robot' in mode) {
    audio.setVoice({ clips: {}, fx: NEUTRAL_FX });
    audio.announce(row.line); // no clip request: speech synthesis
  } else {
    audio.setVoice({ clips: voice.packs[mode.pack], fx: mode.fx });
    audio.announce(row.line, row.req);
  }
}

// ---- grid ----
const grid = document.getElementById('grid')!;
const table = document.createElement('table');
const head1 = table.insertRow();
const head2 = table.insertRow();
const corner = document.createElement('th'); corner.rowSpan = 2; corner.textContent = 'Line'; head1.append(corner);
const robotTh = document.createElement('th'); robotTh.rowSpan = 2; robotTh.textContent = 'Old robot voice'; head1.append(robotTh);
for (const p of packNames) {
  const th = document.createElement('th'); th.className = 'pack'; th.colSpan = presetNames.length; th.textContent = packLabel(p); head1.append(th);
  for (const n of presetNames) { const h = document.createElement('th'); h.textContent = n; head2.append(h); }
}
const customTh = document.createElement('th'); customTh.rowSpan = 2; customTh.textContent = 'Custom (sliders)'; head1.append(customTh);

function cell(tr: HTMLTableRowElement, label: string, fn: () => void): void {
  const td = tr.insertCell(); const b = document.createElement('button'); b.textContent = label; b.onclick = fn; td.append(b);
}
for (const row of rows) {
  const tr = table.insertRow();
  const th = document.createElement('th'); th.className = 'row'; th.textContent = row.label; tr.append(th);
  cell(tr, 'play', () => playCell(row, { robot: true }));
  for (const p of packNames) for (const n of presetNames) {
    cell(tr, 'play', () => playCell(row, { pack: p, fx: resolveFx(voice.presets, n) }));
  }
  cell(tr, 'play', () => playCell(row, { pack: customPack, fx: custom }));
}
grid.append(table);

// ---- custom sliders ----
const readout = document.getElementById('readout') as HTMLTextAreaElement;
const sliders = document.getElementById('sliders')!;
const inputs = new Map<keyof VoiceFx, { range: HTMLInputElement; out: HTMLSpanElement }>();
for (const f of fxKeys) {
  const label = document.createElement('label'); label.textContent = f.key;
  const range = document.createElement('input');
  range.type = 'range'; range.min = String(f.min); range.max = String(f.max); range.step = String(f.step);
  const out = document.createElement('span');
  range.oninput = () => { custom = { ...custom, [f.key]: Number(range.value) }; refresh(); };
  sliders.append(label, range, out);
  inputs.set(f.key, { range, out });
}
function refresh(): void {
  for (const f of fxKeys) {
    const i = inputs.get(f.key)!;
    i.range.value = String(custom[f.key]);
    i.out.textContent = String(custom[f.key]) + (f.key === 'highCut' && custom.highCut >= 20000 ? ' (off)' : '');
  }
  readout.value = `// custom announcer settings (pack: ${customPack})\n`
    + `pack: '${customPack}',\n`
    + `fx: ${JSON.stringify(custom, null, 2)}`;
}
const packSel = document.getElementById('customPack') as HTMLSelectElement;
for (const p of packNames) packSel.add(new Option(packLabel(p), p));
packSel.onchange = () => { customPack = packSel.value; refresh(); };
const presetSel = document.getElementById('customPreset') as HTMLSelectElement;
for (const n of presetNames) presetSel.add(new Option(n, n));
presetSel.onchange = () => { custom = resolveFx(voice.presets, presetSel.value); refresh(); };
document.getElementById('copy')!.onclick = () => {
  const done = (m: string) => { document.getElementById('copied')!.textContent = m; };
  navigator.clipboard.writeText(readout.value).then(() => done('copied'), () => { readout.select(); done('select and copy manually'); });
};
custom = resolveFx(voice.presets, presetNames[0]);
refresh();
