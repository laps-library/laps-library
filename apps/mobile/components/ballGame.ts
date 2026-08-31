import { supabase } from "../lib/supabase";

export const LEVEL_DURATION = 30;

export type GameState = {
  active: boolean;
  score: number;
  timeLeft: number;
  elapsed: number;
  lives: number;
  level: number;
  combo: number;
  mult: number;
  scale: string | null;
  over: boolean;
  finalScore: number;
  overReason: "time" | "lives" | null;
  flash: { text: string; at: number } | null;
};

type Listener = (s: GameState) => void;

let curScale: string | null = null;
let curRoot: number | null = null;
let saveScore = true;

export function setScoreSave(on: boolean) {
  saveScore = on;
}
let state: GameState = {
  active: false,
  score: 0,
  timeLeft: LEVEL_DURATION,
  elapsed: 0,
  lives: 3,
  level: 1,
  combo: 0,
  mult: 1,
  scale: null,
  over: false,
  finalScore: 0,
  overReason: null,
  flash: null,
};
let listeners: Listener[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

function emit() {
  const snap = { ...state };
  listeners.forEach((l) => l(snap));
}

let emitQueued = false;
function queueEmit() {
  if (emitQueued) return;
  emitQueued = true;
  setTimeout(() => {
    emitQueued = false;
    emit();
  }, 0);
}

function flash(text: string) {
  state.flash = { text, at: Date.now() };
}

export function flashMsg(text: string) {
  if (!state.active) return;
  flash(text);
  queueEmit();
}

export function getGameState(): GameState {
  return { ...state };
}

export function onGameStateChange(l: Listener) {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

export function startGame(scale: string, root: number) {
  if (timer) clearInterval(timer);
  curScale = scale;
  curRoot = root;
  state = {
    active: true,
    score: 0,
    timeLeft: LEVEL_DURATION,
    elapsed: 0,
    lives: 3,
    level: 1,
    combo: 0,
    mult: 1,
    scale,
    over: false,
    finalScore: 0,
    overReason: null,
    flash: null,
  };
  emit();
  timer = setInterval(() => {
    if (!state.active) return;
    state.timeLeft -= 1;
    state.elapsed += 1;
    state.score += 2;
    if (state.timeLeft <= 0) void finishGame("time");
    else emit();
  }, 1000);
}

export function addPoints(n: number) {
  if (!state.active) return;
  state.score += Math.round(n * state.mult);
  queueEmit();
}

export function registerBlock() {
  if (!state.active) return;
  state.combo += 1;
  const newMult = Math.min(1 + state.combo * 0.1, 3);
  if (state.combo % 5 === 0) flash("COMBO x" + newMult.toFixed(1));
  state.mult = newMult;
  queueEmit();
}

export function addLife() {
  if (!state.active) return;
  if (state.lives < 5) {
    state.lives += 1;
    flash("+1 VIE");
  } else {
    state.score += 100;
    flash("VIES PLEINES +100");
  }
  emit();
}

export function loseLife() {
  if (!state.active) return;
  state.lives -= 1;
  if (state.combo > 0) flash("COMBO PERDU");
  state.combo = 0;
  state.mult = 1;
  if (state.lives <= 0) void finishGame("lives");
  else emit();
}

export function levelUp() {
  if (!state.active) return;
  state.level += 1;
  state.score += 100;
  state.timeLeft = LEVEL_DURATION;
  emit();
}

async function finishGame(reason: "time" | "lives") {
  if (!state.active) return;
  const finalScore = state.score;
  state = { ...state, active: false, over: true, finalScore, overReason: reason };
  if (timer) clearInterval(timer);
  emit();
  try {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (uid && saveScore) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("pseudo")
        .eq("id", uid)
        .single();
      await supabase.from("ball_scores").insert({
        user_id: uid,
        score: finalScore,
        scale: curScale,
        root: curRoot,
        duration_sec: state.elapsed,
        pseudo: prof?.pseudo ?? null,
      });
    }
  } catch (e) {}
}

export function endGame() {
  if (state.active) void finishGame(state.timeLeft <= 0 ? "time" : "lives");
}

export function clearOver() {
  if (state.over) {
    state = { ...state, over: false };
    emit();
  }
}
