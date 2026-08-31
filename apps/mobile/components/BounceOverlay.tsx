import React, { useEffect, useRef, useState } from "react";
import { Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getMusicConfig, noteFromDegree, noteName, pickNote, pickWallNote, playBounceNote, playLifeLost, playSpawnNote, startRecording, stopRecording, type WaveName } from "./ballAudio";
import { buildMidi } from "./midi";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { encode } from "base64-arraybuffer";
import {
  addLife,
  addPoints,
  clearOver,
  endGame,
  flashMsg,
  getGameState,
  levelUp,
  loseLife,
  onGameStateChange,
  registerBlock,
  type GameState,
} from "./ballGame";

const BALL_SIZE = 26;
const MAX_BALLS = 3;
const SPEED_MIN = 6;
const SPEED_MAX = 9.5;
const SQUASH_DURATION = 220;
const PADDLE_W = 110;
const PADDLE_H = 14;
const PADDLE_Y_OFFSET = 140;
const BLOCK_H = 22;
const BLOCK_GAP = 6;
const BLOCK_COLS = 6;

const THEMES: Record<string, { block: string; border: string; ball: string; bg: [string, string] }> = {
  "Pentatonique mineure": { block: "rgba(90,120,255,0.25)", border: "#5a78ff", ball: "#5a78ff", bg: ["#000000", "#0a1030"] },
  "Pentatonique majeure": { block: "rgba(255,200,60,0.22)", border: "#ffc83c", ball: "#ffc83c", bg: ["#000000", "#2a1e05"] },
  Majeure: { block: "rgba(255,255,255,0.18)", border: "#ffffff", ball: "#ffffff", bg: ["#000000", "#1c1c22"] },
  "Mineure naturelle": { block: "rgba(150,80,255,0.25)", border: "#9650ff", ball: "#9650ff", bg: ["#000000", "#170a2a"] },
  Blues: { block: "rgba(255,110,40,0.25)", border: "#ff6e28", ball: "#ff6e28", bg: ["#000000", "#2a0e02"] },
  Dorienne: { block: "rgba(40,220,180,0.22)", border: "#28dcb4", ball: "#28dcb4", bg: ["#000000", "#03211c"] },
};
const DEFAULT_THEME = THEMES["Pentatonique mineure"];

type DropKind = "wide" | "slow" | "fire" | "multi" | "life" | "shrink";
const DROP_UI: Record<DropKind, { label: string; color: string }> = {
  wide: { label: "R+", color: "#28dcb4" },
  slow: { label: "RA", color: "#5a78ff" },
  fire: { label: "FEU", color: "#ff6e28" },
  multi: { label: "x3", color: "#ff2bd6" },
  life: { label: "+1", color: "#4cd964" },
  shrink: { label: "R-", color: "#9a9a9a" },
};

type Ball = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  note: number;
  lastSound: number;
  stuck: boolean;
  fallen?: boolean;
  degree: number;
  wave: WaveName;
  size: number;
  dur: number;
  ptMult: number;
  bounced?: boolean;
  collided?: boolean;
  squash: number;
  squashAxis: "x" | "y";
  squashTime: number;
  scaleX: number;
  scaleY: number;
};
type Block = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  note: number;
  alive: boolean;
  special: boolean;
  hp: number;
  row: number;
};
type Drop = { id: number; x: number; y: number; kind: DropKind };
type Rect = { x: number; y: number; w: number; h: number };
type Theme = { block: string; border: string; ball: string; bg: [string, string] };

const g: any = globalThis as any;
if (!g.__lapsBounce) {
  g.__lapsBounce = { interactionOn: false, obstacleMap: new Map<string, Rect>() };
}
const S = g.__lapsBounce;

let interactionListeners: ((on: boolean) => void)[] = [];
let launcher: (() => void) | null = null;

export function setBallInteraction(on: boolean) {
  S.interactionOn = !!on;
  interactionListeners.forEach((l) => l(!!on));
}

export function ballInteractionOn(): boolean {
  return !!S.interactionOn;
}

export function onBallInteractionChange(listener: (on: boolean) => void) {
  interactionListeners.push(listener);
  return () => {
    interactionListeners = interactionListeners.filter((i) => i !== listener);
  };
}

export function registerObstacle(_id: string, _rect: Rect) {}
export function unregisterObstacle(_id: string) {}

export function spawnBallAt(_x: number, _y: number) {
  if (S.interactionOn && launcher) launcher();
}

function makeBall(x: number, y: number, stuck = false): Ball {
  const angle = Math.random() * Math.PI * 2;
  const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
  const r = Math.random();
  const art =
    r < 0.3
      ? { size: 18, dur: 0.15, ptMult: 2 }
      : r < 0.7
        ? { size: 26, dur: 0.4, ptMult: 1 }
        : { size: 34, dur: 0.85, ptMult: 0.75 };
  return {
    id: Date.now() + Math.random(),
    x,
    y,
    vx: stuck ? 0 : Math.cos(angle) * speed,
    vy: stuck ? 0 : Math.sin(angle) * speed,
    note: pickNote(),
    lastSound: 0,
    stuck,
    degree: Math.floor(Math.random() * 8),
    wave: "morph",
    size: art.size,
    dur: art.dur,
    ptMult: art.ptMult,
    squash: 0,
    squashAxis: "y",
    squashTime: 0,
    scaleX: 1,
    scaleY: 1,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function collides(ball: Ball, rect: Rect) {
  return (
    ball.x < rect.x + rect.w &&
    ball.x + ball.size > rect.x &&
    ball.y < rect.y + rect.h &&
    ball.y + ball.size > rect.y
  );
}

function pickKind(): DropKind {
  const r = Math.random();
  if (r < 0.25) return "wide";
  if (r < 0.45) return "slow";
  if (r < 0.6) return "fire";
  if (r < 0.75) return "multi";
  if (r < 0.8) return "life";
  return "shrink";
}

function buildBlocks(level: number): Block[] {
  const { width } = Dimensions.get("window");
  const rows = Math.min(3 + (level - 1), 6);
  const margin = 12;
  const bw = (width - margin * 2 - BLOCK_GAP * (BLOCK_COLS - 1)) / BLOCK_COLS;
  const { root, intervals } = getMusicConfig();
  const pattern = (level - 1) % 4;
  const center = (BLOCK_COLS - 1) / 2;
  const blocks: Block[] = [];
  let id = 1;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      let keep = true;
      if (pattern === 1) keep = (r + col) % 2 === 0;
      else if (pattern === 2) keep = Math.abs(col - center) <= center - r * 0.5 + 0.01;
      else if (pattern === 3) keep = col % 3 !== 1 || r % 2 === 0;
      if (!keep) continue;
      let note = root + intervals[col % intervals.length] + 12 * (2 - (r % 3));
      while (note < 0) note += 12;
      while (note > 87) note -= 12;
      blocks.push({
        id: id++,
        x: margin + col * (bw + BLOCK_GAP),
        y: 90 + r * (BLOCK_H + BLOCK_GAP),
        w: bw,
        h: BLOCK_H,
        note,
        alive: true,
        special: Math.random() < 0.12,
        hp: level >= 2 && Math.random() < 0.2 ? 2 : 1,
        row: r,
      });
    }
  }
  return blocks;
}

function arpeggio(notes: number[]) {
  notes.forEach((n, i) => setTimeout(() => playSpawnNote(n), i * 70));
}

const BlocksLayer = React.memo(
  ({ version, blocks, theme }: { version: number; blocks: Block[]; theme: Theme }) => (
    <>
      {blocks.map((b) =>
        b.alive ? (
          <View
            key={b.id}
            style={[
              styles.block,
              {
                left: b.x,
                top: b.y,
                width: b.w,
                height: b.h,
                backgroundColor: b.special
                  ? "rgba(255,255,255,0.85)"
                  : b.hp > 1
                    ? theme.border
                    : theme.block,
                borderColor: b.special ? "#ffffff" : theme.border,
                opacity: b.hp > 1 ? 0.9 : 1,
              },
            ]}
          />
        ) : null
      )}
    </>
  )
);

export default function BounceOverlay() {
  const [balls, setBalls] = useState<Ball[]>([]);
  const [drops, setDrops] = useState<Drop[]>([]);
  const ballsRef = useRef<Ball[]>([]);
  const dropsRef = useRef<Drop[]>([]);
  const lastDrops = useRef(0);
  const blocksRef = useRef<Block[]>([]);
  const clearedRows = useRef<Set<number>>(new Set());
  const [blocksVersion, setBlocksVersion] = useState(0);
  const paddleX = useRef((Dimensions.get("window").width - PADDLE_W) / 2);
  const paddleW = useRef(PADDLE_W);
  const effects = useRef({ wideUntil: 0, slowUntil: 0, fireUntil: 0, shrinkUntil: 0 });
  const [game, setGame] = useState<GameState>(getGameState());
  const noteLabels = useRef<{ id: number; x: number; y: number; text: string; at: number }[]>([]);

  const theme = THEMES[game.scale ?? ""] ?? DEFAULT_THEME;

  useEffect(() => onGameStateChange(setGame), []);

  useEffect(
    () =>
      onBallInteractionChange((on) => {
        if (!on) {
          ballsRef.current = [];
          dropsRef.current = [];
          setBalls([]);
          setDrops([]);
        }
      }),
    []
  );

  useEffect(() => {
    if (game.active) {
      startRecording();
      blocksRef.current = buildBlocks(game.level);
      clearedRows.current = new Set();
      dropsRef.current = [];
      setDrops([]);
      effects.current = { wideUntil: 0, slowUntil: 0, fireUntil: 0, shrinkUntil: 0 };
      ballsRef.current = [makeBall(0, 0, true)];
      setBalls(ballsRef.current);
      setBlocksVersion((v) => v + 1);
    } else {
      blocksRef.current = [];
      setBlocksVersion((v) => v + 1);
    }
  }, [game.active, game.level]);

  useEffect(() => {
    if (!game.over) return;
    const evts = stopRecording();
    if (evts && evts.length > 0) {
      (async () => {
        try {
          const bytes = buildMidi(evts);
          const b64 = encode(bytes.buffer as ArrayBuffer);
          const path = `${FileSystem.documentDirectory}laps-partie-${Date.now()}.mid`;
          await FileSystem.writeAsStringAsync(path, b64, { encoding: "base64" });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(path, {
              mimeType: "audio/midi",
              dialogTitle: "Sauvegarder la musique de la partie (.mid)",
            });
          }
        } catch (e) {}
      })();
    }
    const t = setTimeout(() => clearOver(), 4000);
    return () => clearTimeout(t);
  }, [game.over]);

  function pushLabel(x: number, y: number, note: number) {
    noteLabels.current.push({ id: Date.now() + Math.random(), x, y, text: noteName(note), at: Date.now() });
    if (noteLabels.current.length > 8) noteLabels.current = noteLabels.current.slice(-8);
  }

  function launch() {
    const stuck = ballsRef.current.find((b) => b.stuck);
    if (!stuck) return;
    stuck.stuck = false;
    stuck.vy = -(SPEED_MIN + 2);
    stuck.vx = (Math.random() * 2 - 1) * 3;
    playSpawnNote(stuck.note);
    pushLabel(stuck.x, stuck.y, stuck.note);
  }

  function splitBall(ball: Ball) {
    const room = MAX_BALLS - ballsRef.current.length;
    if (room <= 0) return;
    const want = Math.min(1 + Math.floor(Math.random() * 2), room);
    for (let i = 0; i < want; i++) {
      const extra = makeBall(ball.x, ball.y);
      ballsRef.current.push(extra);
      playSpawnNote(extra.note);
      pushLabel(extra.x, extra.y, extra.note);
    }
    setBalls(ballsRef.current.slice());
  }

  useEffect(() => {
    launcher = launch;
    return () => {
      launcher = null;
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => getGameState().active,
      onMoveShouldSetPanResponder: () => getGameState().active,
      onPanResponderMove: (e) => {
        const { width } = Dimensions.get("window");
        paddleX.current = clamp(e.nativeEvent.locationX - paddleW.current / 2, 0, width - paddleW.current);
      },
      onPanResponderRelease: (e, gs) => {
        if (Math.abs(gs.dx) < 8 && Math.abs(gs.dy) < 8) {
          const tx = e.nativeEvent.locationX;
          const ty = e.nativeEvent.locationY;
          const hit = ballsRef.current.find(
            (b) => !b.stuck && Math.hypot(tx - (b.x + b.size / 2), ty - (b.y + b.size / 2)) < Math.max(b.size, 30)
          );
          if (hit) splitBall(hit);
          else launch();
        }
      },
    })
  ).current;

  useEffect(() => {
    let mounted = true;

    const tick = () => {
      if (!mounted) return;
      if (ballsRef.current.length === 0 && !getGameState().active) return;
      try {
        const { width, height } = Dimensions.get("window");
        const now = Date.now();
        const st = getGameState();
        const fx = effects.current;

        let pw = PADDLE_W;
        if (now < fx.wideUntil) pw = Math.round(PADDLE_W * 1.5);
        else if (now < fx.shrinkUntil) pw = Math.round(PADDLE_W * 0.7);
        paddleW.current = pw;

        const fireActive = now < fx.fireUntil;
        const speedF = (now < fx.slowUntil ? 0.6 : 1) * (1 + Math.min(st.combo, 20) * 0.02);
        const paddleRect: Rect = { x: paddleX.current, y: height - PADDLE_Y_OFFSET, w: pw, h: PADDLE_H };

        const spawned: Ball[] = [];
        let next = ballsRef.current.map((ball) => {
          if (ball.stuck) {
            return {
              ...ball,
              x: paddleX.current + (pw - ball.size) / 2,
              y: height - PADDLE_Y_OFFSET - ball.size,
            };
          }

          let { x, y, vx, vy } = ball;
          const px = x;
          const py = y;
          let bounced = false;
          let bounceAxis: "x" | "y" | null = null;
          let wallHit = false;

          x += vx * speedF;
          y += vy * speedF;

          if (x <= 0) {
            x = 0;
            vx = Math.abs(vx);
            if (Math.abs(vy) < 1.5) vy = vy === 0 ? 1.5 : Math.sign(vy) * 1.5;
            bounced = true;
            bounceAxis = "x";
            wallHit = true;
          }
          if (x >= width - ball.size) {
            x = width - ball.size;
            vx = -Math.abs(vx);
            if (Math.abs(vy) < 1.5) vy = vy === 0 ? 1.5 : Math.sign(vy) * 1.5;
            bounced = true;
            bounceAxis = "x";
            wallHit = true;
          }
          if (y <= 0) {
            y = 0;
            vy = Math.abs(vy);
            bounced = true;
            bounceAxis = "y";
            wallHit = true;
          }

          let fallen = false;
          if (y > height + ball.size) fallen = true;

          const nb: Ball = { ...ball, x, y, vx, vy };

          if (wallHit && st.active) {
            nb.note = pickWallNote();
            nb.wave = "sine";
            addPoints(Math.round(2 * nb.ptMult));
          }

          if (!fallen && st.active && vy > 0 && collides(nb, paddleRect)) {
            const center = paddleRect.x + paddleRect.w / 2;
            const off = clamp((nb.x + nb.size / 2 - center) / (paddleRect.w / 2), -1, 1);
            vy = -Math.abs(vy);
            vx = off * 6.5;
            y = paddleRect.y - nb.size;
            nb.vx = vx;
            nb.vy = vy;
            nb.y = y;
            bounced = true;
            bounceAxis = "y";
            nb.degree += 1 + (st.combo >= 10 ? 1 : 0);
            nb.note = noteFromDegree(nb.degree);
            nb.wave = "pluck";
            addPoints(Math.round(5 * nb.ptMult));
          }

          if (!fallen && st.active) {
            for (const block of blocksRef.current) {
              if (!block.alive || !collides(nb, block)) continue;
              const fromLeft = px + ball.size <= block.x;
              const fromRight = px >= block.x + block.w;

              if (fireActive) {
                block.alive = false;
                addPoints(Math.round(25 * nb.ptMult));
                registerBlock();
                setBlocksVersion((v) => v + 1);
                afterDestroy(block);
                if (blocksRef.current.every((b) => !b.alive)) levelUp();
                continue;
              }

              if (block.hp > 1) {
                block.hp -= 1;
                if (fromLeft || fromRight) nb.vx = -nb.vx;
                else nb.vy = -nb.vy;
                nb.note = noteFromDegree(0);
                bounced = true;
                bounceAxis = fromLeft || fromRight ? "x" : "y";
                addPoints(10);
                setBlocksVersion((v) => v + 1);
                break;
              }

              if (fromLeft || fromRight) nb.vx = -nb.vx;
              else nb.vy = -nb.vy;
              block.alive = false;
              nb.note = block.note;
              bounced = true;
              bounceAxis = fromLeft || fromRight ? "x" : "y";
              addPoints(Math.round(25 * nb.ptMult));
              registerBlock();
              setBlocksVersion((v) => v + 1);
              afterDestroy(block);
              if (block.special && ballsRef.current.length + spawned.length < MAX_BALLS) {
                const extra = makeBall(block.x + block.w / 2, block.y + block.h);
                extra.vy = Math.abs(extra.vy) + 2;
                spawned.push(extra);
              }
              if (blocksRef.current.every((b) => !b.alive)) levelUp();
              break;
            }
          }

          let squash = ball.squash;
          let squashAxis = ball.squashAxis;
          let squashTime = ball.squashTime;
          if (bounced && bounceAxis) {
            squash = 1;
            squashAxis = bounceAxis;
            squashTime = now;
          }

          return { ...nb, bounced, fallen, squash, squashAxis, squashTime };
        });

        if (spawned.length > 0) next = next.concat(spawned);

        function afterDestroy(block: Block) {
          if (Math.random() < 0.15) {
            dropsRef.current.push({
              id: Date.now() + Math.random(),
              x: block.x + block.w / 2 - 13,
              y: block.y + block.h,
              kind: pickKind(),
            });
          }
          const rowBlocks = blocksRef.current.filter((b) => b.row === block.row);
          if (!clearedRows.current.has(block.row) && rowBlocks.every((b) => !b.alive)) {
            clearedRows.current.add(block.row);
            addPoints(50);
            flashMsg("RANGÉE COMPLETE +50");
            arpeggio(rowBlocks.slice(0, 6).map((b) => b.note));
            pushLabel(block.x + block.w / 2, block.y, rowBlocks[0]?.note ?? block.note);
          }
        }

        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i];
            const b = next[j];
            if (a.stuck || b.stuck) continue;
            const dx = b.x + b.size / 2 - (a.x + a.size / 2);
            const dy = b.y + b.size / 2 - (a.y + a.size / 2);
            const dist = Math.hypot(dx, dy);
            const minDist = (a.size + b.size) / 2;
            if (dist < minDist && dist > 0) {
              const nx = dx / dist;
              const ny = dy / dist;
              const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
              if (dvn > 0) {
                a.vx -= dvn * nx;
                a.vy -= dvn * ny;
                b.vx += dvn * nx;
                b.vy += dvn * ny;
              }
              const overlap = minDist - dist;
              a.x -= (overlap / 2) * nx;
              a.y -= (overlap / 2) * ny;
              b.x += (overlap / 2) * nx;
              b.y += (overlap / 2) * ny;
              const axis: "x" | "y" = Math.abs(nx) > Math.abs(ny) ? "x" : "y";
              a.squash = 1;
              a.squashAxis = axis;
              a.squashTime = now;
              b.squash = 1;
              b.squashAxis = axis;
              b.squashTime = now;
              a.collided = true;
              b.collided = true;
            }
          }
        }

        const keptDrops: Drop[] = [];
        for (const d of dropsRef.current) {
          d.y += 2.5;
          const dRect: Rect = { x: d.x, y: d.y, w: 26, h: 14 };
          if (d.y > height) continue;
          if (
            dRect.y + dRect.h >= paddleRect.y &&
            dRect.y <= paddleRect.y + paddleRect.h &&
            dRect.x + dRect.w >= paddleRect.x &&
            dRect.x <= paddleRect.x + paddleRect.w
          ) {
            applyDrop(d.kind, d.x, d.y);
            continue;
          }
          keptDrops.push(d);
        }
        dropsRef.current = keptDrops;

        function applyDrop(kind: DropKind, x: number, y: number) {
          const fx2 = effects.current;
          if (kind === "wide") {
            fx2.wideUntil = now + 10000;
            fx2.shrinkUntil = 0;
            flashMsg("RAQUETTE +");
          } else if (kind === "slow") {
            fx2.slowUntil = now + 6000;
            flashMsg("RALENTI");
          } else if (kind === "fire") {
            fx2.fireUntil = now + 5000;
            flashMsg("FEU");
          } else if (kind === "shrink") {
            fx2.shrinkUntil = now + 8000;
            fx2.wideUntil = 0;
            flashMsg("PIÈGE");
          } else if (kind === "life") {
            addLife();
          } else if (kind === "multi") {
            flashMsg("MULTI");
            let count = 0;
            while (ballsRef.current.length + count < MAX_BALLS && count < 2) {
              const extra = makeBall(x, y);
              extra.vy = Math.abs(extra.vy) + 2;
              next.push(extra);
              count++;
            }
          }
          arpeggio([noteFromDegree(0), noteFromDegree(2), noteFromDegree(4)]);
          pushLabel(x, y, noteFromDegree(2));
        }

        let fell = 0;
        const aliveNext: Ball[] = [];
        for (const ball of next) {
          if (ball.fallen) {
            fell++;
            continue;
          }
          let scaleX = 1;
          let scaleY = 1;
          const elapsed = now - ball.squashTime;
          if (ball.squash > 0 && elapsed < SQUASH_DURATION) {
            const decay = 1 - elapsed / SQUASH_DURATION;
            const amt = ball.squash * decay * 0.35;
            if (ball.squashAxis === "y") {
              scaleY = 1 - amt;
              scaleX = 1 + amt;
            } else {
              scaleX = 1 - amt;
              scaleY = 1 + amt;
            }
          }
          if ((ball.bounced || ball.collided) && now - ball.lastSound > 110) {
            ball.lastSound = now;
            playBounceNote(ball.note, ball.dur, ball.wave);
            pushLabel(ball.x, ball.y, ball.note);
          }
          aliveNext.push({ ...ball, scaleX, scaleY, bounced: false, collided: false });
        }

        if (fell > 0 && st.active) {
          for (let i = 0; i < fell; i++) loseLife();
          playLifeLost();
        }
        if (st.active && getGameState().active && aliveNext.length === 0) {
          aliveNext.push(makeBall(0, 0, true));
        }

        ballsRef.current = aliveNext;
        setBalls(aliveNext);
        if (dropsRef.current.length > 0 || lastDrops.current > 0) {
          setDrops(dropsRef.current.slice());
        }
        lastDrops.current = dropsRef.current.length;
      } catch (e) {
        console.error("TICK ERROR", e);
      }
    };

    const iv = setInterval(tick, 16);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  const { width, height } = Dimensions.get("window");
  const hasStuck = balls.some((b) => b.stuck);
  const fireNow = game.active && Date.now() < effects.current.fireUntil;
  if (balls.length === 0 && !game.active && !game.over) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={game.active ? "auto" : "none"}
      {...panResponder.panHandlers}
    >
      {game.active && (
        <LinearGradient colors={theme.bg} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {game.active && <BlocksLayer version={blocksVersion} blocks={blocksRef.current} theme={theme} />}
      {drops.map((d) => (
        <View
          key={d.id}
          style={[styles.drop, { left: d.x, top: d.y, borderColor: DROP_UI[d.kind].color }]}
        >
          <Text style={[styles.dropText, { color: DROP_UI[d.kind].color }]}>{DROP_UI[d.kind].label}</Text>
        </View>
      ))}
      {game.active && (
        <View style={[styles.paddle, { left: clamp(paddleX.current, 0, width - paddleW.current), top: height - PADDLE_Y_OFFSET, width: paddleW.current }]} />
      )}
      {balls.map((ball) => (
        <View
          key={ball.id}
          style={[
            styles.ball,
            {
              width: ball.size,
              height: ball.size,
              borderRadius: ball.size / 2,
              borderColor: fireNow ? "#ff6e28" : theme.ball,
              shadowColor: fireNow ? "#ff6e28" : theme.ball,
              left: clamp(ball.x, 0, width - ball.size),
              top: clamp(ball.y, 0, height - ball.size),
              transform: [{ scaleX: ball.scaleX }, { scaleY: ball.scaleY }],
            },
          ]}
        />
      ))}
      {game.active && (
        <View style={styles.hud}>
          <Text style={styles.hudScore}>{game.score}</Text>
          <Text style={styles.hudTime}>{game.timeLeft}s</Text>
          <Text style={styles.hudLives}>♥{game.lives}</Text>
          <Text style={styles.hudLevel}>N{game.level}</Text>
          <Text style={styles.hudMult}>x{game.mult.toFixed(1)}</Text>
          {fireNow && <Text style={styles.hudFire}>FEU</Text>}
        </View>
      )}
      {game.active && (
        <Pressable
          style={styles.quitBtn}
          onPress={() => {
            endGame();
            setBallInteraction(false);
          }}
        >
          <Text style={styles.quitBtnText}>QUITTER</Text>
        </Pressable>
      )}
      {game.active && hasStuck && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>TOUCHE POUR LANCER LA BALLE</Text>
        </View>
      )}
      {noteLabels.current
        .filter((l) => Date.now() - l.at < 700)
        .map((l) => (
          <Text key={l.id} style={[styles.noteLabel, { left: l.x, top: l.y - 20 }]}>
            {l.text}
          </Text>
        ))}
      {game.active && game.flash && Date.now() - game.flash.at < 1200 && (
        <View style={styles.flashBox}>
          <Text style={styles.flashText}>{game.flash.text}</Text>
        </View>
      )}
      {game.over && (
        <View style={styles.overBox}>
          <Text style={styles.overTitle}>
            {game.overReason === "lives" ? "PARTIE PERDUE" : "TEMPS ECOULE"}
          </Text>
          <Text style={styles.overScore}>SCORE {game.finalScore}</Text>
          <Text style={styles.overLevel}>NIVEAU ATTEINT : {game.level}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ball: {
    position: "absolute",
    backgroundColor: "#000000",
    borderWidth: 2,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  block: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 4,
  },
  drop: {
    position: "absolute",
    width: 26,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  dropText: { fontSize: 8, fontWeight: "bold", fontStyle: "italic" },
  paddle: {
    position: "absolute",
    height: PADDLE_H,
    backgroundColor: "#ffffff",
    borderRadius: 7,
  },
  hud: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  hudScore: { color: "#ff2bd6", fontWeight: "bold", fontStyle: "italic", fontSize: 13, letterSpacing: 0.5 },
  hudTime: { color: "#fff", fontWeight: "bold", fontStyle: "italic", fontSize: 13, letterSpacing: 0.5 },
  hudLives: { color: "#ff2bd6", fontWeight: "bold", fontStyle: "italic", fontSize: 13, letterSpacing: 0.5 },
  hudLevel: { color: "#ff2bd6", fontWeight: "bold", fontStyle: "italic", fontSize: 13, letterSpacing: 0.5 },
  hudMult: { color: "#fff", fontWeight: "bold", fontStyle: "italic", fontSize: 13, letterSpacing: 0.5 },
  hudFire: { color: "#ff6e28", fontWeight: "bold", fontStyle: "italic", fontSize: 13, letterSpacing: 0.5 },
  hudQuit: { color: "#9a9a9a", fontWeight: "bold", fontStyle: "italic", fontSize: 11, letterSpacing: 0.5 },
  quitBtn: { position: "absolute", top: 54, right: 12, borderWidth: 1, borderColor: "#9a9a9a", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(0,0,0,0.6)" },
  quitBtnText: { color: "#9a9a9a", fontSize: 10, fontWeight: "bold", fontStyle: "italic", letterSpacing: 1 },
  noteLabel: { position: "absolute", color: "#fff", fontSize: 10, fontWeight: "bold", fontStyle: "italic", opacity: 0.9 },
  hint: { position: "absolute", top: "55%", left: 0, right: 0, alignItems: "center" },
  hintText: { color: "#9a9a9a", fontStyle: "italic", fontWeight: "bold", fontSize: 12, letterSpacing: 1 },
  flashBox: { position: "absolute", top: "48%", left: 0, right: 0, alignItems: "center" },
  flashText: { color: "#ff2bd6", fontWeight: "bold", fontStyle: "italic", fontSize: 18, letterSpacing: 2 },
  overBox: {
    position: "absolute",
    top: "42%",
    left: 40,
    right: 40,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderWidth: 1,
    borderColor: "#ff2bd6",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    gap: 6,
  },
  overTitle: { color: "#fff", fontWeight: "bold", fontStyle: "italic", fontSize: 14, letterSpacing: 2 },
  overScore: { color: "#ff2bd6", fontWeight: "bold", fontStyle: "italic", fontSize: 26, letterSpacing: 1 },
  overLevel: { color: "#ccc", fontSize: 12, fontStyle: "italic" },
});
