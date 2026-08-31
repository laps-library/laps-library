import { createAudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { encode } from "base64-arraybuffer";

const SR = 22050;

const SCALES: Record<string, number[]> = {
  "Pentatonique mineure": [0, 3, 5, 7, 10],
  "Pentatonique majeure": [0, 2, 4, 7, 9],
  Majeure: [0, 2, 4, 5, 7, 9, 11],
  "Mineure naturelle": [0, 2, 3, 5, 7, 8, 10],
  Blues: [0, 3, 5, 6, 7, 10],
  Dorienne: [0, 2, 3, 5, 7, 9, 10],
};

export const SCALE_NAMES = Object.keys(SCALES);
const DEFAULT_SCALE = "Pentatonique mineure";
const DEFAULT_ROOT = 48;

let scaleName = DEFAULT_SCALE;
let rootNote = DEFAULT_ROOT;
let firstPlayed = false;

export function configureBallMusic(root: number, scale: string) {
  rootNote = Math.max(0, Math.min(87, root || DEFAULT_ROOT));
  scaleName = SCALES[scale] ? scale : DEFAULT_SCALE;
  firstPlayed = false;
}

export function getMusicConfig() {
  return { root: rootNote, intervals: SCALES[scaleName] ?? SCALES[DEFAULT_SCALE] };
}

export function noteFromDegree(degree: number): number {
  const scale = SCALES[scaleName] ?? SCALES[DEFAULT_SCALE];
  const oct = Math.floor(degree / scale.length);
  const idx = ((degree % scale.length) + scale.length) % scale.length;
  let i = rootNote + scale[idx] + oct * 12;
  while (i < 0) i += 12;
  while (i > 87) i -= 12;
  return i;
}

function freq(i: number) {
  return 27.5 * Math.pow(2, i / 12);
}

export function noteName(i: number) {
  const names = ["Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
  const midi = i + 21;
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function pickNote(): number {
  if (!firstPlayed) {
    firstPlayed = true;
    return rootNote;
  }
  const scale = SCALES[scaleName] ?? SCALES[DEFAULT_SCALE];
  const degree = scale[Math.floor(Math.random() * scale.length)];
  const octave = (Math.floor(Math.random() * 3) - 1) * 12;
  let i = rootNote + degree + octave;
  while (i < 0) i += 12;
  while (i > 87) i -= 12;
  return i;
}

export type WaveName = "sine" | "morph" | "pluck" | "bell";

function waveSample(wave: WaveName, f: number, t: number): number {
  const ph = 2 * Math.PI * f * t;
  const sine = Math.sin(ph);
  if (wave === "sine") return sine;
  if (wave === "pluck")
    return (
      sine * 0.6 +
      Math.sin(2 * ph) * 0.3 * Math.exp(-5 * t) +
      Math.sin(3 * ph) * 0.15 * Math.exp(-8 * t)
    );
  if (wave === "bell")
    return (
      sine * 0.5 +
      Math.sin(2.76 * ph) * 0.3 * Math.exp(-2.5 * t) +
      Math.sin(5.4 * ph) * 0.12 * Math.exp(-5 * t)
    );
  const tri = (2 / Math.PI) * Math.asin(Math.sin(ph));
  const m = Math.min(1, t / 0.4);
  return tri * (1 - m) + sine * m;
}

function buildWav(i: number, wave: WaveName, dur: number): ArrayBuffer {
  const tail = 0.6;
  const n = Math.floor(SR * (dur + tail));
  const dry = new Float32Array(n);
  const f = freq(i) * (1 + (Math.random() - 0.5) * 0.005);
  const ATTACK = 0.008;
  const RELEASE = Math.min(0.45, dur * 0.5);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    let env = Math.exp(-3 * t);
    if (t < ATTACK) env *= t / ATTACK;
    if (t > dur - RELEASE && t < dur) env *= 0.5 * (1 + Math.cos(Math.PI * ((t - (dur - RELEASE)) / RELEASE)));
    if (t >= dur) env = 0;
    dry[k] = waveSample(wave, f, t) * env * 0.5;
  }

  const d1 = Math.floor(0.093 * SR);
  const d2 = Math.floor(0.147 * SR);
  const wet = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let v = dry[k];
    if (k >= d1) v += 0.38 * wet[k - d1];
    wet[k] = v;
  }
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let v = wet[k];
    if (k >= d2) v += 0.22 * wet[k - d2];
    out[k] = v;
  }

  const bytes = new ArrayBuffer(44 + n * 2);
  const view = new DataView(bytes);
  const writeStr = (off: number, s: string) => {
    for (let k = 0; k < s.length; k++) view.setUint8(off + k, s.charCodeAt(k));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SR, true);
  view.setUint32(28, SR * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, n * 2, true);
  const CUTOFF = wave === "sine" ? 500 : 750;
  const a = 1 - Math.exp((-2 * Math.PI * CUTOFF) / SR);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    lp += a * (out[k] - lp);
    view.setInt16(44 + k * 2, Math.max(-1, Math.min(1, lp)) * 32767, true);
  }
  return bytes;
}

const uriCache: Record<string, string> = {};

async function noteUri(i: number, wave: WaveName, dur: number): Promise<string> {
  const key = `${i}_${wave}_${dur}`;
  if (uriCache[key]) return uriCache[key];
  const dir = `${FileSystem.cacheDirectory}ballnotes_v6/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir);
  const path = `${dir}note_${key}.wav`;
  const finfo = await FileSystem.getInfoAsync(path);
  if (!finfo.exists) {
    await FileSystem.writeAsStringAsync(path, encode(buildWav(i, wave, dur)), { encoding: "base64" });
  }
  uriCache[key] = path;
  return path;
}

let livePlayers = 0;

async function play(i: number, wave: WaveName, volume: number, dur: number) {
  if (rec) rec.push({ t: (Date.now() - recStart) / 1000, midi: i + 21, dur });
  if (livePlayers >= 14) return;
  livePlayers++;
  try {
    const uri = await noteUri(i, wave, dur);
    const player = createAudioPlayer({ uri });
    player.volume = volume;
    player.play();
    setTimeout(() => {
      try {
        player.remove();
      } catch (e) {}
      livePlayers = Math.max(0, livePlayers - 1);
    }, Math.min(1600, Math.ceil((dur + 0.65) * 1000)));
  } catch (e) {}
}

export function playSpawnNote(i: number) {
  play(i, "bell", 0.7, 0.5);
}

export function playBounceNote(i: number, dur: number = 0.4, wave: WaveName = "morph") {
  play(i, wave, 0.5, dur);
}

function buildOoh(): ArrayBuffer {
  const dur = 1.1;
  const n = Math.floor(SR * dur);
  const dry = new Float32Array(n);
  const voices = 7;
  for (let v = 0; v < voices; v++) {
    const base = 160 + v * 25 + Math.random() * 12;
    const startF = base * 1.2;
    const endF = base * 0.82;
    const vibRate = 5 + Math.random() * 2;
    const vibAmt = 0.01;
    const amp = 0.1 + Math.random() * 0.06;
    let ph = 0;
    for (let k = 0; k < n; k++) {
      const t = k / SR;
      const f = startF + (endF - startF) * (t / dur);
      ph += (2 * Math.PI * f * (1 + Math.sin(2 * Math.PI * vibRate * t + v) * vibAmt)) / SR;
      const s = Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.15 * Math.sin(3 * ph);
      const wob = 0.7 + 0.3 * Math.sin(2 * Math.PI * (1.3 + v * 0.27) * t + v * 2);
      dry[k] += s * amp * wob;
    }
  }
  let lpn = 0;
  for (let k = 0; k < n; k++) {
    const white = Math.random() * 2 - 1;
    lpn += 0.06 * (white - lpn);
    dry[k] += lpn * 0.2;
  }
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    let env = 1;
    if (t < 0.1) env = t / 0.1;
    if (t > dur - 0.45) env = Math.max(0, (dur - t) / 0.45);
    dry[k] *= env;
  }
  const bytes = new ArrayBuffer(44 + n * 2);
  const view = new DataView(bytes);
  const writeStr = (off: number, s: string) => {
    for (let k = 0; k < s.length; k++) view.setUint8(off + k, s.charCodeAt(k));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SR, true);
  view.setUint32(28, SR * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, n * 2, true);
  const a = 1 - Math.exp((-2 * Math.PI * 900) / SR);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    lp += a * (dry[k] - lp);
    view.setInt16(44 + k * 2, Math.max(-1, Math.min(1, lp)) * 32767, true);
  }
  return bytes;
}

let oohUri: string | null = null;

export function playLifeLost() {
  (async () => {
    try {
      if (!oohUri) {
        const dir = `${FileSystem.cacheDirectory}ballnotes_v6/`;
        const info = await FileSystem.getInfoAsync(dir);
        if (!info.exists) await FileSystem.makeDirectoryAsync(dir);
        const path = `${dir}crowd_ooh.wav`;
        const finfo = await FileSystem.getInfoAsync(path);
        if (!finfo.exists) {
          await FileSystem.writeAsStringAsync(path, encode(buildOoh()), { encoding: "base64" });
        }
        oohUri = path;
      }
      const player = createAudioPlayer({ uri: oohUri });
      player.volume = 0.9;
      player.play();
      setTimeout(() => {
        try {
          player.remove();
        } catch (e) {}
      }, 1400);
    } catch (e) {}
  })();
}

let rec: { t: number; midi: number; dur: number }[] | null = null;
let recStart = 0;

export function startRecording() {
  rec = [];
  recStart = Date.now();
}

export function stopRecording() {
  const r = rec;
  rec = null;
  return r;
}

let wallMode: "sequence" | "random" = "sequence";
let wallStep = 0;

export function setWallMode(m: "sequence" | "random") {
  wallMode = m;
  wallStep = 0;
}

export function pickWallNote(): number {
  const scale = SCALES[scaleName] ?? SCALES[DEFAULT_SCALE];
  let i: number;
  if (wallMode === "random") {
    i = rootNote + scale[Math.floor(Math.random() * scale.length)];
  } else {
    i = rootNote + scale[wallStep % scale.length];
    wallStep++;
  }
  while (i < 0) i += 12;
  while (i > 87) i -= 12;
  return i;
}
