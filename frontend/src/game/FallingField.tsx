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

const GAP = 84; // vertical spacing between fruits in the stream
const FRUIT = 56;
const BUFFER = 4; // fruits kept queued just above the top edge
const INITIAL = 9;
export const TURBO_SCORE = 200;

// Fall speed in px/sec. Slowly ramps, then jumps to "super fast" at TURBO_SCORE.
export function speedFor(score: number): number {
  if (score < TURBO_SCORE) return 120 + score * 1.15; // gradual increase
  return 620 + (score - TURBO_SCORE) * 3.2; // super fast turbo
}

type Bead = { id: number; type: FruitType; x: number; baseY: number };

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

  const missY = useCallback(() => dimsRef.current!.h - FRUIT - 4, []);

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
      fruitsRef.current = fruitsRef.current.filter((b) => b.id !== low.id);
      scoreRef.current += 1;
      onScore(scoreRef.current);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      force();
    },
    [onGameOver, onScore, stop]
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
  const low = lowestOf(fruitsRef.current);
  const lowId = low ? low.id : -1;

  return (
    <View style={styles.field} onLayout={onLayout}>
      {dims &&
        fruitsRef.current.map((b) => {
          const y = b.baseY + travel;
          if (y < -FRUIT - 8 || y > dims.h + FRUIT) return null;
          const isTarget = b.id === lowId;
          return (
            <View
              key={b.id}
              style={[styles.fruit, { transform: [{ translateX: b.x }, { translateY: y }] }]}
            >
              {isTarget && <View pointerEvents="none" style={styles.ring} />}
              <FruitToken type={b.type} size={FRUIT} />
            </View>
          );
        })}
      {dims && <View pointerEvents="none" style={[styles.catchLine, { top: dims.h - FRUIT + FRUIT / 2 - 4 }]} />}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { flex: 1, overflow: "hidden" },
  fruit: { position: "absolute", top: 0, left: 0, width: FRUIT, height: FRUIT },
  ring: {
    position: "absolute",
    top: -7,
    left: -7,
    width: FRUIT + 14,
    height: FRUIT + 14,
    borderRadius: (FRUIT + 14) / 2,
    borderWidth: 3,
    borderColor: "#FFB454",
  },
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
