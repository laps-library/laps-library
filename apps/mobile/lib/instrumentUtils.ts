import { LOCAL_PHOTOS } from "../assets/instruments/manifest";
import { LOCAL_FULL_PHOTOS } from "../assets/instruments/manifest-full";

export function cleanKey(s: string): string {
  return (s || "")
    .toString()
    .trim()
    .replace(/[\/\\:*?"<>|']/g, "")
    .replace(/\s+/g, "-");
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function ytId(v: string): string {
  const m = (v || "").match(/(?:watch\?v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : v || "";
}

const PHOTO_ALIASES: Record<string, string> = {
  "OBX8 Module": "Oberheim/OBX-8-DESKTOP",
};

const STATION_NAME_PHOTO_OVERRIDES: Record<string, string> = {
  "Production Phonographique": "Teenage-Engineering/APC-2",
  "Traitement du Signal": "Sherman/Filterbank 2 Dual ",
};

const ACCESSORY_LINES = [
  "interface audio ssl 18",
  "casque shure srh440a",
  "× 2 unités reliées en polychain",
];

export function isAccessory(line: string): boolean {
  const l = line.toLowerCase();
  return ACCESSORY_LINES.some((a) => l.includes(a)) || l.startsWith("keystage");
}

function findIn(manifest: Record<string, any>, i: any) {
  const k = cleanKey(i.brand) + "/" + cleanKey(i.name);
  if (manifest[k]) return manifest[k];
  const found = Object.keys(manifest).find((key) => norm(key) === norm(k));
  if (found) return manifest[found];
  const nameNorm = norm(cleanKey(i.name));
  const foundName = Object.keys(manifest).find(
    (key) => norm(key.split("/").pop() || "") === nameNorm,
  );
  if (foundName) return manifest[foundName];
  return null;
}

function packageFallback(manifest: Record<string, any>, i: any) {
  for (const item of i.package ?? []) {
    const alias = PHOTO_ALIASES[item];
    if (alias && manifest[alias]) return manifest[alias];
    const ck = norm(cleanKey(item));
    const foundPkg = Object.keys(manifest).find((key) => norm(key.split("/")[1] ?? "") === ck);
    if (foundPkg) return manifest[foundPkg];
  }
  return null;
}

export function photoSource(i: any) {
  return findIn(LOCAL_PHOTOS as any, i);
}

export function fullPhotoSource(i: any) {
  return findIn(LOCAL_FULL_PHOTOS as any, i) ?? packageFallback(LOCAL_FULL_PHOTOS as any, i);
}

export function stationPhotoSource(st: any) {
  const override = STATION_NAME_PHOTO_OVERRIDES[st.name];
  if (override && (LOCAL_PHOTOS as any)[override]) return (LOCAL_PHOTOS as any)[override];
  const own = photoSource(st);
  if (own) return own;
  const brandKey = norm(cleanKey(st.brand ?? ""));
  for (const item of st.package ?? []) {
    const alias = PHOTO_ALIASES[item];
    if (alias && (LOCAL_PHOTOS as any)[alias]) return (LOCAL_PHOTOS as any)[alias];
    const ck = norm(cleanKey(item));
    const foundDirect = Object.keys(LOCAL_PHOTOS).find((k) => norm(k.split("/")[1] ?? "") === ck);
    if (foundDirect) return (LOCAL_PHOTOS as any)[foundDirect];
    const ckNoBrand = ck.startsWith(brandKey) ? ck.slice(brandKey.length) : ck;
    const foundNoBrand = Object.keys(LOCAL_PHOTOS).find(
      (k) => norm(k.split("/")[1] ?? "") === ckNoBrand,
    );
    if (foundNoBrand) return (LOCAL_PHOTOS as any)[foundNoBrand];
  }
  return null;
}
