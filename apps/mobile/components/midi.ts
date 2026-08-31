export type NoteEvent = { t: number; midi: number; dur: number };

function vlq(n: number): number[] {
  const out = [n & 0x7f];
  n >>= 7;
  while (n > 0) {
    out.unshift((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return out;
}

export function buildMidi(events: NoteEvent[]): Uint8Array {
  const TPQ = 480;
  const ticksPerSec = TPQ * 2;
  type Ev = { tick: number; on: boolean; midi: number };
  const evs: Ev[] = [];
  for (const e of events) {
    evs.push({ tick: Math.round(e.t * ticksPerSec), on: true, midi: e.midi });
    evs.push({ tick: Math.round((e.t + Math.max(0.1, e.dur)) * ticksPerSec), on: false, midi: e.midi });
  }
  evs.sort((a, b) => a.tick - b.tick || (a.on === b.on ? 0 : a.on ? 1 : -1));

  const body: number[] = [];
  body.push(0, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20);
  let last = 0;
  for (const ev of evs) {
    const d = Math.max(0, ev.tick - last);
    last = ev.tick;
    body.push(...vlq(d));
    body.push(ev.on ? 0x90 : 0x80, Math.max(0, Math.min(127, ev.midi)), ev.on ? 96 : 64);
  }
  body.push(0, 0xff, 0x2f, 0x00);

  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (TPQ >> 8) & 0xff, TPQ & 0xff];
  const len = body.length;
  const track = [
    0x4d, 0x54, 0x72, 0x6b,
    (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff,
  ];
  return new Uint8Array([...header, ...track, ...body]);
}
