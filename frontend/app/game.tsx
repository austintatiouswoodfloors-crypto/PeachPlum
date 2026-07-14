import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Platform, KeyboardAvoidingView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Animated, { ZoomIn } from "react-native-reanimated";

import { COLORS, FruitType } from "@/src/game/theme";
import { FruitToken } from "@/src/game/FruitToken";
import { FallingField, FieldHandle, TURBO_SCORE } from "@/src/game/FallingField";
import { storage } from "@/src/utils/storage";
import { submitScore } from "@/src/game/api";
import { BEST_KEY } from "./index";

export default function Game() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<"playing" | "over">("playing");
  const [isNewBest, setIsNewBest] = useState(false);

  // game over / ranking state
  const [name, setName] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "done">("idle");

  const fieldRef = useRef<FieldHandle>(null);
  const scoreRef = useRef(0);
  const bestRef = useRef(0);

  const handleScore = useCallback((s: number) => {
    scoreRef.current = s;
    setScore(s);
    if (s === TURBO_SCORE) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, []);

  const handleGameOver = useCallback((finalScore: number) => {
    const newBest = finalScore > bestRef.current;
    setIsNewBest(newBest);
    if (newBest) {
      bestRef.current = finalScore;
      setBest(finalScore);
      storage.setItem(BEST_KEY, finalScore);
    }
    setPhase("over");
  }, []);

  const restart = useCallback(() => {
    setIsNewBest(false);
    setName("");
    setSubmitState("idle");
    setPhase("playing");
    fieldRef.current?.restart();
  }, []);

  useEffect(() => {
    storage.getItem(BEST_KEY, 0).then((v) => {
      bestRef.current = Number(v) || 0;
      setBest(Number(v) || 0);
    });
  }, []);

  const onSubmit = useCallback(async () => {
    if (submitState !== "idle") return;
    setSubmitState("sending");
    try {
      await submitScore(name.trim() || "Guest", scoreRef.current);
      setSubmitState("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setSubmitState("idle");
    }
  }, [name, submitState]);

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

      {/* falling stream */}
      <FallingField ref={fieldRef} onScore={handleScore} onGameOver={handleGameOver} />

      {/* buttons */}
      <View style={[styles.buttons, { paddingBottom: insets.bottom + 20 }]}>
        <FruitButton type="peach" onPress={() => fieldRef.current?.press("peach")} />
        <FruitButton type="plum" onPress={() => fieldRef.current?.press("plum")} />
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
              <Text style={styles.overTitle}>GAME OVER</Text>
              <Text style={styles.overScore} testID="final-score">
                {score}
              </Text>
              <Text style={styles.overBest}>BEST {best}</Text>

              {submitState === "done" ? (
                <View style={styles.doneBox}>
                  <Ionicons name="checkmark-circle" size={20} color="#3BA55C" />
                  <Text style={styles.doneText}>Submitted to ranking!</Text>
                </View>
              ) : (
                <View style={styles.submitRow}>
                  <TextInput
                    testID="name-input"
                    value={name}
                    onChangeText={setName}
                    placeholder="Name"
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
                      {submitState === "sending" ? "…" : "SAVE"}
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
                  <Text style={styles.retryText}>RETRY</Text>
                </LinearGradient>
              </Pressable>

              <View style={styles.overRow}>
                <Pressable
                  testID="overlay-home-button"
                  onPress={() => router.replace("/")}
                  style={({ pressed }) => [styles.overSmall, pressed && styles.pressed]}
                >
                  <Ionicons name="home-outline" size={18} color={COLORS.ink} />
                  <Text style={styles.overSmallText}>HOME</Text>
                </Pressable>
                <Pressable
                  testID="overlay-ranking-button"
                  onPress={() => router.push("/ranking")}
                  style={({ pressed }) => [styles.overSmall, pressed && styles.pressed]}
                >
                  <Ionicons name="podium-outline" size={18} color={COLORS.ink} />
                  <Text style={styles.overSmallText}>RANKING</Text>
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
  return (
    <Pressable
      testID={`tap-${type}-button`}
      onPress={onPress}
      hitSlop={16}
      style={({ pressed }) => [styles.fruitBtn, pressed && { transform: [{ scale: 0.88 }] }]}
    >
      <FruitToken type={type} size={150} />
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
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  meterLabel: { width: 62, color: COLORS.inkSoft, fontWeight: "900", fontSize: 12, letterSpacing: 2 },
  turboLabel: { color: "#E23A2E" },
  barTrack: {
    flex: 1,
    height: 12,
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
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  fruitBtn: {
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
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

