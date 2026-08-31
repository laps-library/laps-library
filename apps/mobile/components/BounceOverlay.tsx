import React, { useEffect, useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { pickNote, playBounceNote, playSpawnNote } from "./ballAudio";

const BALL_SIZE = 26;
const BALL_LIFE = 6000;
const MAX_BALLS = 6;
const SPEED_MIN = 4;
const SPEED_MAX = 7;
const SQUASH_DURATION = 220;

type Ball = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  note: number;
  lastSound: number;
  bounced?: boolean;
  collided?: boolean;
  squash: number;
  squashAxis: "x" | "y";
  squashTime: number;
  scaleX: number;
  scaleY: number;
};

type Rect = { x: number; y: number; w: number; h: number };
type Listener = (ball: Ball) => void;

const g: any = globalThis as any;
if (!g.__lapsBounce) {
  g.__lapsBounce = {
    interactionOn: false,
    obstacleMap: new Map<string, Rect>(),
  };
}
const S = g.__lapsBounce;

let listeners: Listener[] = [];
let interactionListeners: ((on: boolean) => void)[] = [];

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

export function registerObstacle(id: string, rect: Rect) {
  S.obstacleMap.set(id, rect);
}

export function unregisterObstacle(id: string) {
  S.obstacleMap.delete(id);
}

function makeBall(x: number, y: number): Ball {
  const angle = Math.random() * Math.PI * 2;
  const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
  return {
    id: Date.now() + Math.random(),
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    born: Date.now(),
    note: pickNote(),
    lastSound: 0,
    squash: 0,
    squashAxis: "y",
    squashTime: 0,
    scaleX: 1,
    scaleY: 1,
  };
}

export function spawnBallAt(x: number, y: number) {
  listeners.forEach((listener) => listener(makeBall(x, y)));
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function collides(ball: Ball, rect: Rect) {
  return (
    ball.x < rect.x + rect.w &&
    ball.x + BALL_SIZE > rect.x &&
    ball.y < rect.y + rect.h &&
    ball.y + BALL_SIZE > rect.y
  );
}

export default function BounceOverlay() {
  const [balls, setBalls] = useState<Ball[]>([]);
  const ballsRef = useRef<Ball[]>([]);

  useEffect(() => {
    const unsub = onBallInteractionChange((on) => {
      if (!on) {
        ballsRef.current = [];
        setBalls([]);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const listener = (ball: Ball) => {
      if (!S.interactionOn) return;
      const next = [...ballsRef.current, ball].slice(-MAX_BALLS);
      ballsRef.current = next;
      setBalls(next);
      playSpawnNote(ball.note);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((i) => i !== listener);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const tick = () => {
      if (!mounted) return;
      if (ballsRef.current.length === 0) return;
      try {
        const { width, height } = Dimensions.get("window");
        const now = Date.now();
        const obstacles = Array.from(S.obstacleMap.values()) as Rect[];

        let next = ballsRef.current
          .filter((b) => now - b.born < BALL_LIFE)
          .map((ball) => {
            let { x, y, vx, vy } = ball;
            const px = x,
              py = y;
            let bounced = false;
            let bounceAxis: "x" | "y" | null = null;

            x += vx;
            y += vy;

            if (x <= 0) {
              x = 0;
              vx = Math.abs(vx);
              bounced = true;
              bounceAxis = "x";
            }
            if (x >= width - BALL_SIZE) {
              x = width - BALL_SIZE;
              vx = -Math.abs(vx);
              bounced = true;
              bounceAxis = "x";
            }
            if (y <= 0) {
              y = 0;
              vy = Math.abs(vy);
              bounced = true;
              bounceAxis = "y";
            }
            if (y >= height - BALL_SIZE) {
              y = height - BALL_SIZE;
              vy = -Math.abs(vy);
              bounced = true;
              bounceAxis = "y";
            }

            const nb: Ball = { ...ball, x, y, vx, vy };

            for (const obstacle of obstacles) {
              if (!collides(nb, obstacle)) continue;
              const fromLeft = px + BALL_SIZE <= obstacle.x;
              const fromRight = px >= obstacle.x + obstacle.w;
              const fromTop = py + BALL_SIZE <= obstacle.y;
              const fromBottom = py >= obstacle.y + obstacle.h;
              if (fromLeft || fromRight) {
                vx = -vx;
                bounceAxis = "x";
              } else if (fromTop || fromBottom) {
                vy = -vy;
                bounceAxis = "y";
              } else {
                vx = -vx;
                vy = -vy;
                bounceAxis = "x";
              }
              x += vx;
              y += vy;
              bounced = true;
              break;
            }

            let squash = ball.squash;
            let squashAxis = ball.squashAxis;
            let squashTime = ball.squashTime;
            if (bounced && bounceAxis) {
              squash = 1;
              squashAxis = bounceAxis;
              squashTime = now;
            }

            return { ...nb, x, y, vx, vy, bounced, squash, squashAxis, squashTime };
          });

        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i],
              b = next[j];
            const dx = b.x + BALL_SIZE / 2 - (a.x + BALL_SIZE / 2);
            const dy = b.y + BALL_SIZE / 2 - (a.y + BALL_SIZE / 2);
            const dist = Math.hypot(dx, dy);
            if (dist < BALL_SIZE && dist > 0) {
              const nx = dx / dist,
                ny = dy / dist;
              const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
              if (dvn > 0) {
                a.vx -= dvn * nx;
                a.vy -= dvn * ny;
                b.vx += dvn * nx;
                b.vy += dvn * ny;
              }
              const overlap = BALL_SIZE - dist;
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

        next = next.map((ball) => {
          let scaleX = 1,
            scaleY = 1;
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
          if (ball.bounced && now - ball.lastSound > 250) {
            ball.lastSound = now;
            playBounceNote(ball.note);
          }
          if (ball.collided && now - ball.lastSound > 250) {
            ball.lastSound = now;
            playBounceNote(ball.note);
          }
          return { ...ball, scaleX, scaleY, bounced: false, collided: false };
        });

        ballsRef.current = next;
        setBalls(next);
      } catch (_) {}
    };

    const iv = setInterval(tick, 16);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  if (balls.length === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {balls.map((ball) => (
        <View
          key={ball.id}
          style={[
            styles.ball,
            {
              left: clamp(ball.x, 0, Dimensions.get("window").width - BALL_SIZE),
              top: clamp(ball.y, 0, Dimensions.get("window").height - BALL_SIZE),
              transform: [{ scaleX: ball.scaleX }, { scaleY: ball.scaleY }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ball: {
    position: "absolute",
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    backgroundColor: "#000000",
    borderWidth: 2,
    borderColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
});
