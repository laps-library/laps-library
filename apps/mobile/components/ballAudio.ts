import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { encode } from 'base64-arraybuffer';

const SR = 22050;
const DUR = 0.7;

const SCALES: Record<string, number[]> = {
  'Pentatonique mineure': [0, 3, 5, 7, 10],
  'Pentatonique majeure': [0, 2, 4, 7, 9],
  'Majeure': [0, 2, 4, 5, 7, 9, 11],
  'Mineure naturelle': [0, 2, 3, 5, 7, 8, 10],
  'Blues': [0, 3, 5, 6, 7, 10],
  'Dorienne': [0, 2, 3, 5, 7, 9, 10],
};

export const SCALE_NAMES = Object.keys(SCALES);
const DEFAULT_SCALE = 'Pentatonique mineure';
const DEFAULT_ROOT = 48;

let scaleName = DEFAULT_SCALE;
let rootNote = DEFAULT_ROOT;
let firstPlayed = false;

export function configureBallMusic(root: number, scale: string) {
  rootNote = Math.max(0, Math.min(87, root || DEFAULT_ROOT));
  scaleName = SCALES[scale] ? scale : DEFAULT_SCALE;
  firstPlayed = false;
}

function freq(i: number) {
  return 27.5 * Math.pow(2, i / 12);
}

export function noteName(i: number) {
  const names = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
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

type Wave = 'sine' | 'morph';

function waveSample(wave: Wave, f: number, t: number): number {
  const ph = 2 * Math.PI * f * t;
  const sine = Math.sin(ph);
  if (wave === 'sine') return sine;
  const tri = (2 / Math.PI) * Math.asin(Math.sin(ph));
  const m = Math.min(1, t / 0.4);
  return tri * (1 - m) + sine * m;
}

function buildWav(i: number, wave: Wave): ArrayBuffer {
  const n = Math.floor(SR * DUR);
  const bytes = new ArrayBuffer(44 + n * 2);
  const view = new DataView(bytes);
  const writeStr = (off: number, s: string) => {
    for (let k = 0; k < s.length; k++) view.setUint8(off + k, s.charCodeAt(k));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SR, true);
  view.setUint32(28, SR * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, n * 2, true);
  const f = freq(i);
  const ATTACK = 0.008;
  const RELEASE = 0.45;
  const CUTOFF = 600;
  const a = 1 - Math.exp((-2 * Math.PI * CUTOFF) / SR);
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    let env = Math.exp(-3 * t);
    if (t < ATTACK) env *= t / ATTACK;
    if (t > DUR - RELEASE) {
      const u = (t - (DUR - RELEASE)) / RELEASE;
      env *= 0.5 * (1 + Math.cos(Math.PI * u));
    }
    const raw = waveSample(wave, f, t) * env * 0.5;
    lp += a * (raw - lp);
    view.setInt16(44 + k * 2, Math.max(-1, Math.min(1, lp)) * 32767, true);
  }
  return bytes;
}

const uriCache: Record<string, string> = {};

async function noteUri(i: number, wave: Wave): Promise<string> {
  const key = `${i}_${wave}`;
  if (uriCache[key]) return uriCache[key];
  const dir = `${FileSystem.cacheDirectory}ballnotes_v5/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir);
  const path = `${dir}note_${key}.wav`;
  const finfo = await FileSystem.getInfoAsync(path);
  if (!finfo.exists) {
    await FileSystem.writeAsStringAsync(path, encode(buildWav(i, wave)), { encoding: 'base64' });
  }
  uriCache[key] = path;
  return path;
}

async function play(i: number, wave: Wave, volume: number) {
  try {
    const uri = await noteUri(i, wave);
    const { sound } = await Audio.Sound.createAsync({ uri }, { volume });
    await sound.playAsync();
    setTimeout(() => {
      try { sound.unloadAsync(); } catch (e) {}
    }, 1500);
  } catch (e) {}
}

export function playSpawnNote(i: number) {
  play(i, 'sine', 0.7);
}

export function playBounceNote(i: number) {
  play(i, 'morph', 0.5);
}
