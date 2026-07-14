import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform, KeyboardAvoidingView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  ZoomOut,
  ZoomIn,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  Easing,
  runOnJS,
} from "react-native-reanimated";

import { COLORS, FruitType, LABELS, durationForScore } from "@/src/game/theme";
import { FruitToken } from "@/src/game/FruitToken";
import { storage } from "@/src/utils/storage";
import { submitScore } from "@/src/game/api";
import { BEST_KEY } from "./index";

const FRUIT = 60;
const QUEUE_LEN = 6;

type Bead = { id: number; type: FruitType };

let _uid = 0;
const makeBead = (): Bead => ({ id: _uid++, type: Math.random() < 0.5 ? "peach" : "plum" });
const makeQueue = () => Array.from({ length: QUEUE_LEN }, makeBead);

export default function Game() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [queue, setQueue] = useState<Bead[]>(makeQueue);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<"playing" | "over">("playing");
  const [isNewBest, setIsNewBest] = useState(false);

  // game over / ranking state
  const [name, setName] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "done">("idle");

  const queueRef = useRef(queue);
  const scoreRef = useRef(0);
  const playingRef = useRef(true);
  const bestRef = useRef(0);

  const progress = useSharedValue(1);

  const startFruit = useCallback(
    (dur: number) => {
      cancelAnimation(progress);
      progress.value = 1;
      progress.value = withTiming(0, { duration: dur, easing: Easing.linear }, (finished) => {
        if (finished) runOnJS(handleTimeout)();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const endGame = useCallback(() => {
    if (!playingRef.current) return;
    playingRef.current = false;
    cancelAnimation(progress);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    const finalScore = scoreRef.current;
    const newBest = finalScore > bestRef.current;
    setIsNewBest(newBest);
    if (newBest) {
      bestRef.current = finalScore;
      setBest(finalScore);
      storage.setItem(BEST_KEY, finalScore);
    }
    setPhase("over");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTimeout() {
    endGame();
  }

  const handleTap = useCallback(
    (type: FruitType) => {
      if (!playingRef.current) return;
      const target = queueRef.current[0];
      if (!target) return;
      if (type !== target.type) {
        endGame();
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const next = scoreRef.current + 1;
      scoreRef.current = next;
      setScore(next);
      const nq = queueRef.current.slice(1);
      nq.push(makeBead());
      queueRef.current = nq;
      setQueue(nq);
      startFruit(durationForScore(next));
    },
    [endGame, startFruit]
  );

  const restart = useCallback(() => {
    const q = makeQueue();
    queueRef.current = q;
    scoreRef.current = 0;
    playingRef.current = true;
    setQueue(q);
    setScore(0);
    setIsNewBest(false);
    setName("");
    setSubmitState("idle");
    setPhase("playing");
    startFruit(durationForScore(0));
  }, [startFruit]);

  useEffect(() => {
    storage.getItem(BEST_KEY, 0).then((v) => {
      bestRef.current = Number(v) || 0;
      setBest(Number(v) || 0);
    });
    startFruit(durationForScore(0));
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const onSubmit = useCallback(async () => {
    if (submitState !== "idle") return;
    setSubmitState("sending");
    try {
      await submitScore(name.trim() || "ゲスト", scoreRef.current);
      setSubmitState("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setSubmitState("idle");
    }
  }, [name, submitState]);

  // render top->bottom, but queue[0] is the target (bottom), so reverse
  const rendered = [...queue].reverse();

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.fill} testID="game-screen">
      {/* top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="home-button" onPress={() => router.replace("/")} style={styles.iconBtn}>
          <Ionicons name="home" size={22} color={COLORS.ink} />
        </Pressable>
        <View style={styles.scoreWrap}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue} testID="score-value">
            {score}
          </Text>
        </View>
        <View style={styles.bestBox}>
          <Ionicons name="trophy" size={14} color={COLORS.peach.btnTo} />
          <Text style={styles.bestBoxText}>{best}</Text>
        </View>
      </View>

      {/* speed bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, barStyle]}>
          <LinearGradient
            colors={[COLORS.peach.btnFrom, COLORS.plum.btnFrom]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      {/* falling stack lane */}
      <View style={styles.lane}>
        <View style={styles.string} pointerEvents="none" />
        <View style={styles.stack}>
          {rendered.map((b, i) => {
            const isTarget = b.id === queue[0]?.id;
            return (
              <Animated.View
                key={b.id}
                layout={LinearTransition.springify().damping(18).stiffness(160)}
                entering={FadeInDown.duration(180)}
                exiting={ZoomOut.duration(160)}
                style={styles.bead}
              >
                <View style={isTarget ? styles.targetBead : undefined}>
                  <FruitToken type={b.type} size={FRUIT} />
                </View>
              </Animated.View>
            );
          })}
        </View>
        <View style={styles.catchLine} pointerEvents="none">
          <Ionicons name="chevron-up" size={20} color={COLORS.inkSoft} />
        </View>
      </View>

      {/* buttons */}
      <View style={[styles.buttons, { paddingBottom: insets.bottom + 16 }]}>
        <FruitButton type="peach" onPress={() => handleTap("peach")} />
        <FruitButton type="plum" onPress={() => handleTap("plum")} />
      </View>

      {/* game over overlay */}
      {phase === "over" && (
        <View style={styles.overlay} testID="gameover-overlay">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.overlayCenter}
          >
            <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.overCard}>
              {isNewBest && (
                <View style={styles.newBestBadge}>
                  <Ionicons name="sparkles" size={14} color="#fff" />
                  <Text style={styles.newBestText}>NEW BEST!</Text>
                </View>
              )}
              <Text style={styles.overTitle}>ゲームオーバー</Text>
              <Text style={styles.overScore} testID="final-score">
                {score}
              </Text>
              <Text style={styles.overBest}>ベスト {best}</Text>

              {submitState === "done" ? (
                <View style={styles.doneBox}>
                  <Ionicons name="checkmark-circle" size={20} color="#3BA55C" />
                  <Text style={styles.doneText}>ランキングに登録しました</Text>
                </View>
              ) : (
                <View style={styles.submitRow}>
                  <TextInput
                    testID="name-input"
                    value={name}
                    onChangeText={setName}
                    placeholder="なまえ"
                    placeholderTextColor={COLORS.inkSoft}
                    maxLength={16}
                    style={styles.input}
                    returnKeyType="done"
                    onSubmitEditing={onSubmit}
                  />
                  <Pressable
                    testID="submit-score-button"
                    onPress={onSubmit}
                    disabled={submitState === "sending"}
                    style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.submitBtnText}>
                      {submitState === "sending" ? "…" : "登録"}
                    </Text>
                  </Pressable>
                </View>
              )}

              <Pressable
                testID="retry-button"
                onPress={restart}
                style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={[COLORS.peach.btnFrom, COLORS.peach.btnTo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.retryInner}
                >
                  <Ionicons name="refresh" size={22} color="#fff" />
                  <Text style={styles.retryText}>もう一度</Text>
                </LinearGradient>
              </Pressable>

              <View style={styles.overRow}>
                <Pressable
                  testID="overlay-home-button"
                  onPress={() => router.replace("/")}
                  style={({ pressed }) => [styles.overSmall, pressed && styles.pressed]}
                >
                  <Ionicons name="home-outline" size={18} color={COLORS.ink} />
                  <Text style={styles.overSmallText}>ホーム</Text>
                </Pressable>
                <Pressable
                  testID="overlay-ranking-button"
                  onPress={() => router.push("/ranking")}
                  style={({ pressed }) => [styles.overSmall, pressed && styles.pressed]}
                >
                  <Ionicons name="podium-outline" size={18} color={COLORS.ink} />
                  <Text style={styles.overSmallText}>ランキング</Text>
                </Pressable>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}
    </LinearGradient>
  );
}

function FruitButton({ type, onPress }: { type: FruitType; onPress: () => void }) {
  const c = COLORS[type];
  return (
    <Pressable
      testID={`tap-${type}-button`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fruitBtn,
        { shadowColor: c.btnShadow },
        pressed && { transform: [{ translateY: 4 }], opacity: 0.94 },
      ]}
    >
      <LinearGradient
        colors={[c.btnFrom, c.btnTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.fruitBtnInner}
      >
        <FruitToken type={type} size={52} />
        <Text style={styles.fruitBtnLabel}>{LABELS[type].jp}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  scoreWrap: { alignItems: "center" },
  scoreLabel: { color: COLORS.inkSoft, fontSize: 12, fontWeight: "800", letterSpacing: 3 },
  scoreValue: { color: COLORS.ink, fontSize: 40, fontWeight: "900", lineHeight: 44 },
  bestBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 44,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bestBoxText: { color: COLORS.ink, fontWeight: "800", fontSize: 15 },
  barTrack: {
    height: 12,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: "rgba(90,54,32,0.12)",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999, overflow: "hidden" },
  lane: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 8 },
  string: {
    position: "absolute",
    top: 12,
    bottom: 54,
    width: 4,
    borderRadius: 2,
    backgroundColor: "rgba(90,54,32,0.12)",
  },
  stack: { alignItems: "center", justifyContent: "flex-end" },
  bead: { marginVertical: 1 },
  targetBead: {
    transform: [{ scale: 1.06 }],
  },
  catchLine: {
    marginTop: 6,
    height: 30,
    width: 90,
    borderTopWidth: 3,
    borderColor: COLORS.inkSoft,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "flex-start",
    opacity: 0.6,
  },
  buttons: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  fruitBtn: {
    flex: 1,
    borderRadius: 24,
    shadowOpacity: 0.55,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fruitBtnInner: {
    height: 128,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fruitBtnLabel: { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: 2 },

  // overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(40,20,10,0.55)",
  },
  overlayCenter: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  overCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  newBestBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.peach.btnTo,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 6,
  },
  newBestText: { color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  overTitle: { color: COLORS.inkSoft, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  overScore: { color: COLORS.ink, fontSize: 64, fontWeight: "900", lineHeight: 70 },
  overBest: { color: COLORS.inkSoft, fontSize: 15, fontWeight: "700", marginBottom: 16 },
  submitRow: { flexDirection: "row", gap: 8, width: "100%", marginBottom: 14 },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F6EEE3",
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.ink,
  },
  submitBtn: {
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.plum.btnFrom,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  doneBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
    backgroundColor: "#EAF7EE",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  doneText: { color: "#2E7D46", fontWeight: "800", fontSize: 14 },
  retryBtn: {
    width: "100%",
    borderRadius: 18,
    shadowColor: COLORS.peach.btnShadow,
    shadowOpacity: 0.5,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  retryInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 58,
    borderRadius: 18,
  },
  retryText: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  overRow: { flexDirection: "row", gap: 12, marginTop: 12, width: "100%" },
  overSmall: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F6EEE3",
  },
  overSmallText: { color: COLORS.ink, fontWeight: "800", fontSize: 14 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
