import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useFrameCallback,
  withTiming,
  runOnJS,
  Easing,
  SharedValue,
} from "react-native-reanimated";

import { FruitToken } from "./FruitToken";
import { FruitType } from "./theme";

const GAP = 112; // vertical spacing between fruits (touching, no gap)
const FRUIT = 126;
const BUFFER = 4; // fruits kept queued just above the top edge
const INITIAL = 9;
export const TURBO_SCORE = 180;

// Fall speed in px/sec. Every tap speeds it up; by ~180 taps it's typing-fast.
// After 180 the speed STOPS increasing — instead fruit falls from random positions.
export function speedFor(score: number): number {
  const capped = Math.min(score, TURBO_SCORE);
  return 70 + capped * 2.5;
}

type Bead = { id: number; type: FruitType; x: number; baseY: number };
type BurstItem = { id: number; x: number; y: number; type: FruitType };

export type FieldHandle = { press: (t: FruitType) => void; restart: () => void };

type Props = {
  onScore: (s: number) => void;
  onGameOver: (s: number) => void;
};

let uid = 0;
const rndType = (): FruitType => (Math.random() < 0.5 ? "peach" : "plum");
const GRAVITY = 900;

// ---- Single falling fruit (transform driven on the UI thread) ----
function FallingFruit({ b, travel }: { b: Bead; travel: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: b.x }, { translateY: b.baseY + travel.value }],
  }));
  return (
    <Animated.View style={[styles.fruit, style]}>
      <FruitToken type={b.type} size={FRUIT} />
    </Animated.View>
  );
}

// ---- Firecracker burst (all particles animated by one shared clock) ----
type Part = { vx: number; vy: number; size: number; color: string; life: number };

function makeParts(type: FruitType): Part[] {
  const palette =
    type === "peach"
      ? ["#FFD98A", "#FFB454", "#F26D26", "#FF8A3D", "#FFF3D0"]
      : ["#E8829B", "#C24A63", "#FF5A7A", "#FFD1DC", "#7C1B31"];
  const sparks = ["#FFFFFF", "#FFE27A"];
  const n = 22;
  const out: Part[] = [];
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const sp = 160 + Math.random() * 320;
    const isSpark = Math.random() < 0.35;
    out.push({
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      size: isSpark ? 3 + Math.random() * 3 : 6 + Math.random() * 8,
      color: isSpark
        ? sparks[Math.floor(Math.random() * sparks.length)]
        : palette[Math.floor(Math.random() * palette.length)],
      life: 0.45 + Math.random() * 0.4,
    });
  }
  return out;
}

function Particle({ p, x, y, t }: { p: Part; x: number; y: number; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const tt = t.value * p.life; // seconds elapsed for this particle
    return {
      opacity: Math.max(0, 1 - t.value),
      transform: [
        { translateX: x + p.vx * tt - p.size / 2 },
        { translateY: y + p.vy * tt + 0.5 * GRAVITY * tt * tt - p.size / 2 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", top: 0, left: 0, width: p.size, height: p.size, borderRadius: p.size / 2, backgroundColor: p.color },
        style,
      ]}
    />
  );
}

function Burst({ x, y, type, onDone }: { x: number; y: number; type: FruitType; onDone: () => void }) {
  const t = useSharedValue(0);
  const parts = useMemo(() => makeParts(type), [type]);
  useEffect(() => {
    t.value = withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) }, (f) => {
      if (f) runOnJS(onDone)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {parts.map((p, i) => (
        <Particle key={i} p={p} x={x} y={y} t={t} />
      ))}
    </>
  );
}

export const FallingField = forwardRef<FieldHandle, Props>(function FallingField(
  { onScore, onGameOver },
  ref
) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [fruits, setFruits] = useState<Bead[]>([]);
  const [bursts, setBursts] = useState<BurstItem[]>([]);

  const fruitsRef = useRef<Bead[]>([]);
  const scoreRef = useRef(0);
  const nextBaseYRef = useRef(0);
  const runningRef = useRef(false);
  const dimsRef = useRef<{ w: number; h: number } | null>(null);
  const spawnTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // shared values drive motion on the UI thread (no per-frame React re-render)
  const travel = useSharedValue(0);
  const speed = useSharedValue(speedFor(0));
  const running = useSharedValue(false);
  const missThreshold = useSharedValue(Number.POSITIVE_INFINITY);

  const commit = useCallback((list: Bead[]) => {
    fruitsRef.current = list;
    setFruits(list);
  }, []);

  const xFor = useCallback((score: number) => {
    const w = dimsRef.current!.w;
    if (score < TURBO_SCORE) return w / 2 - FRUIT / 2; // single centered stream
    return 10 + Math.random() * (w - FRUIT - 20); // random across the screen
  }, []);

  const recomputeMiss = useCallback(() => {
    if (!dimsRef.current) return;
    let maxBaseY = -Infinity;
    for (const b of fruitsRef.current) if (b.baseY > maxBaseY) maxBaseY = b.baseY;
    const missY = dimsRef.current.h - 6; // just past the bottom (below the buttons)
    missThreshold.value = maxBaseY === -Infinity ? Number.POSITIVE_INFINITY : missY - maxBaseY;
  }, [missThreshold]);

  const stop = useCallback(() => {
    runningRef.current = false;
    running.value = false;
    if (spawnTimer.current) {
      clearInterval(spawnTimer.current);
      spawnTimer.current = null;
    }
  }, [running]);

  const spawnCheck = useCallback(() => {
    if (!runningRef.current || !dimsRef.current) return;
    let changed = false;
    while (nextBaseYRef.current + travel.value > -GAP * BUFFER) {
      fruitsRef.current = [
        ...fruitsRef.current,
        { id: uid++, type: rndType(), x: xFor(scoreRef.current), baseY: nextBaseYRef.current },
      ];
      nextBaseYRef.current -= GAP;
      changed = true;
    }
    if (changed) {
      setFruits(fruitsRef.current);
      recomputeMiss();
    }
  }, [recomputeMiss, travel, xFor]);

  const handleMiss = useCallback(() => {
    if (!runningRef.current) return;
    stop();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    onGameOver(scoreRef.current);
  }, [onGameOver, stop]);

  const addBurst = useCallback((x: number, y: number, type: FruitType) => {
    const id = uid++;
    setBursts((b) => [...b, { id, x, y, type }]);
  }, []);

  const removeBurst = useCallback((id: number) => {
    setBursts((b) => b.filter((x) => x.id !== id));
  }, []);

  const press = useCallback(
    (type: FruitType) => {
      if (!runningRef.current) return;
      let low: Bead | null = null;
      for (const b of fruitsRef.current) if (!low || b.baseY > low.baseY) low = b;
      if (!low) return;
      if (type !== low.type) {
        stop();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        onGameOver(scoreRef.current);
        return;
      }
      addBurst(low.x + FRUIT / 2, low.baseY + travel.value + FRUIT / 2, low.type);
      commit(fruitsRef.current.filter((b) => b.id !== low!.id));
      scoreRef.current += 1;
      onScore(scoreRef.current);
      speed.value = speedFor(scoreRef.current);
      recomputeMiss();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    },
    [addBurst, commit, onGameOver, onScore, recomputeMiss, speed, stop, travel]
  );

  const restart = useCallback(() => {
    if (!dimsRef.current) return;
    stop();
    travel.value = 0;
    scoreRef.current = 0;
    speed.value = speedFor(0);
    const y0 = 8;
    const list: Bead[] = [];
    for (let k = 0; k < INITIAL; k++) {
      list.push({ id: uid++, type: rndType(), x: xFor(0), baseY: y0 - k * GAP });
    }
    nextBaseYRef.current = y0 - INITIAL * GAP;
    commit(list);
    setBursts([]);
    recomputeMiss();
    onScore(0);
    runningRef.current = true;
    running.value = true;
    spawnTimer.current = setInterval(spawnCheck, 90);
  }, [commit, onScore, recomputeMiss, running, spawnCheck, speed, stop, travel, xFor]);

  useImperativeHandle(ref, () => ({ press, restart }), [press, restart]);

  // advance the stream on the UI thread every frame — smooth, no JS re-render
  useFrameCallback((frame) => {
    "worklet";
    if (!running.value) return;
    const dt = Math.min((frame.timeSincePreviousFrame ?? 16) / 1000, 0.05);
    travel.value += speed.value * dt;
  }, true);

  // frame-accurate miss detection on the UI thread
  useAnimatedReaction(
    () => running.value && travel.value > missThreshold.value,
    (hit, prev) => {
      if (hit && !prev) runOnJS(handleMiss)();
    }
  );

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

  return (
    <View style={styles.field} onLayout={onLayout}>
      {dims && fruits.map((b) => <FallingFruit key={b.id} b={b} travel={travel} />)}
      {dims &&
        bursts.map((bu) => (
          <Burst key={bu.id} x={bu.x} y={bu.y} type={bu.type} onDone={() => removeBurst(bu.id)} />
        ))}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { flex: 1, overflow: "hidden" },
  fruit: { position: "absolute", top: 0, left: 0, width: FRUIT, height: FRUIT },
});
