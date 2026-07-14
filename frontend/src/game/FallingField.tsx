import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useReducer,
  useRef,
  useState,
} from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import * as Haptics from "expo-haptics";

import { FruitToken } from "./FruitToken";
import { COLORS, FruitType } from "./theme";

const GAP = 128; // vertical spacing between fruits in the stream
const FRUIT = 100;
const BUFFER = 4; // fruits kept queued just above the top edge
const INITIAL = 9;
export const TURBO_SCORE = 200;

// Fall speed in px/sec. Starts slow, builds up gradually (reaches the old opening
// pace around ~80 taps) and keeps climbing, then jumps to "super fast" turbo at 200.
export function speedFor(score: number): number {
  if (score < TURBO_SCORE) return 70 + score * 0.75;
  return 520 + (score - TURBO_SCORE) * 3;
}

type Bead = { id: number; type: FruitType; x: number; baseY: number };

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
};

export type FieldHandle = { press: (t: FruitType) => void; restart: () => void };

type Props = {
  onScore: (s: number) => void;
  onGameOver: (s: number) => void;
};

let uid = 0;
const rndType = (): FruitType => (Math.random() < 0.5 ? "peach" : "plum");

export const FallingField = forwardRef<FieldHandle, Props>(function FallingField(
  { onScore, onGameOver },
  ref
) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [, force] = useReducer((x) => x + 1, 0);

  const fruitsRef = useRef<Bead[]>([]);
  const travelRef = useRef(0);
  const scoreRef = useRef(0);
  const nextBaseYRef = useRef(0);
  const runningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const dimsRef = useRef<{ w: number; h: number } | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  const missY = useCallback(() => dimsRef.current!.h - FRUIT - 4, []);

  // Firecracker burst when a fruit pops.
  const burst = useCallback((cx: number, cy: number, type: FruitType) => {
    const palette =
      type === "peach"
        ? ["#FFD98A", "#FFB454", "#F26D26", "#FF8A3D", "#FFF3D0"]
        : ["#E8829B", "#C24A63", "#FF5A7A", "#FFD1DC", "#7C1B31"];
    const sparks = ["#FFFFFF", "#FFE27A"];
    const n = 22;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = 160 + Math.random() * 320;
      const isSpark = Math.random() < 0.35;
      const life = 0.45 + Math.random() * 0.4;
      particlesRef.current.push({
        id: uid++,
        x: cx,
        y: cy,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life,
        maxLife: life,
        size: isSpark ? 3 + Math.random() * 3 : 6 + Math.random() * 8,
        color: isSpark
          ? sparks[Math.floor(Math.random() * sparks.length)]
          : palette[Math.floor(Math.random() * palette.length)],
      });
    }
  }, []);

  const xFor = useCallback((score: number) => {
    const w = dimsRef.current!.w;
    if (score < TURBO_SCORE) return w / 2 - FRUIT / 2; // single centered stream
    return 10 + Math.random() * (w - FRUIT - 20); // random across the screen
  }, []);

  const lowestOf = (list: Bead[]): Bead | null => {
    let low: Bead | null = null;
    for (const b of list) if (!low || b.baseY > low.baseY) low = b;
    return low;
  };

  const buildInitial = useCallback(() => {
    const y0 = 8;
    const list: Bead[] = [];
    for (let k = 0; k < INITIAL; k++) {
      list.push({ id: uid++, type: rndType(), x: xFor(0), baseY: y0 - k * GAP });
    }
    fruitsRef.current = list;
    nextBaseYRef.current = y0 - INITIAL * GAP;
  }, [xFor]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const loop = useCallback(
    (ts: number) => {
      if (!runningRef.current) return;
      const last = lastTsRef.current || ts;
      let dt = (ts - last) / 1000;
      lastTsRef.current = ts;
      if (dt > 0.05) dt = 0.05; // clamp big frame gaps

      travelRef.current += speedFor(scoreRef.current) * dt;

      // keep the stream fed above the top edge
      while (nextBaseYRef.current + travelRef.current > -GAP * BUFFER) {
        fruitsRef.current = [
          ...fruitsRef.current,
          { id: uid++, type: rndType(), x: xFor(scoreRef.current), baseY: nextBaseYRef.current },
        ];
        nextBaseYRef.current -= GAP;
      }

      // miss: the lowest (target) fruit crossed the catch line
      const low = lowestOf(fruitsRef.current);
      if (low && low.baseY + travelRef.current > missY() + 6) {
        stop();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        force();
        onGameOver(scoreRef.current);
        return;
      }

      // advance firecracker particles
      if (particlesRef.current.length) {
        const alive: Particle[] = [];
        for (const p of particlesRef.current) {
          p.life -= dt;
          if (p.life <= 0) continue;
          p.vy += 900 * dt; // gravity
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          alive.push(p);
        }
        particlesRef.current = alive;
      }

      force();
      rafRef.current = requestAnimationFrame(loop);
    },
    [missY, onGameOver, stop, xFor]
  );

  const restart = useCallback(() => {
    if (!dimsRef.current) return;
    stop();
    travelRef.current = 0;
    scoreRef.current = 0;
    lastTsRef.current = 0;
    particlesRef.current = [];
    buildInitial();
    onScore(0);
    runningRef.current = true;
    rafRef.current = requestAnimationFrame(loop);
  }, [buildInitial, loop, onScore, stop]);

  const press = useCallback(
    (type: FruitType) => {
      if (!runningRef.current) return;
      const low = lowestOf(fruitsRef.current);
      if (!low) return;
      if (type !== low.type) {
        stop();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        force();
        onGameOver(scoreRef.current);
        return;
      }
      burst(low.x + FRUIT / 2, low.baseY + travelRef.current + FRUIT / 2, low.type);
      fruitsRef.current = fruitsRef.current.filter((b) => b.id !== low.id);
      scoreRef.current += 1;
      onScore(scoreRef.current);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      force();
    },
    [burst, onGameOver, onScore, stop]
  );

  useImperativeHandle(ref, () => ({ press, restart }), [press, restart]);

  useEffect(() => {
    if (dims) {
      dimsRef.current = dims;
      restart();
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!dims && width > 0 && height > 0) setDims({ w: width, h: height });
  };

  const travel = travelRef.current;

  return (
    <View style={styles.field} onLayout={onLayout}>
      {dims &&
        fruitsRef.current.map((b) => {
          const y = b.baseY + travel;
          if (y < -FRUIT - 8 || y > dims.h + FRUIT) return null;
          return (
            <View
              key={b.id}
              style={[styles.fruit, { transform: [{ translateX: b.x }, { translateY: y }] }]}
            >
              <FruitToken type={b.type} size={FRUIT} />
            </View>
          );
        })}
      {dims &&
        particlesRef.current.map((p) => (
          <View
            key={p.id}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              opacity: Math.max(0, p.life / p.maxLife),
              transform: [{ translateX: p.x - p.size / 2 }, { translateY: p.y - p.size / 2 }],
            }}
          />
        ))}
      {dims && <View pointerEvents="none" style={[styles.catchLine, { top: dims.h - FRUIT + FRUIT / 2 - 4 }]} />}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { flex: 1, overflow: "hidden" },
  fruit: { position: "absolute", top: 0, left: 0, width: FRUIT, height: FRUIT },
  catchLine: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 0,
    borderTopWidth: 3,
    borderStyle: "dashed",
    borderColor: COLORS.inkSoft,
    opacity: 0.55,
  },
});
