import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/src/game/theme";
import { FruitToken } from "@/src/game/FruitToken";
import { storage } from "@/src/utils/storage";

export const BEST_KEY = "momo_best_score";

export default function Title() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [best, setBest] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      storage.getItem(BEST_KEY, 0).then((v) => {
        if (active) setBest(Number(v) || 0);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <LinearGradient
      colors={[COLORS.bgTop, COLORS.bgBottom]}
      style={styles.fill}
      testID="title-screen"
    >
      {/* soft sunburst circle */}
      <View pointerEvents="none" style={styles.sun} />

      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
          <Text style={styles.kicker}>CLOBA ARCADE</Text>
          <Text style={styles.title}>Plum Peach</Text>
          <Text style={styles.subtitle}>FRUIT REACTION GAME</Text>
        </Animated.View>

        {/* fruit cluster */}
        <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.cluster}>
          <View style={{ marginTop: 26 }}>
            <FruitToken type="plum" size={86} />
          </View>
          <View style={{ marginHorizontal: -10, zIndex: 2 }}>
            <FruitToken type="peach" size={116} />
          </View>
          <View style={{ marginTop: 34 }}>
            <FruitToken type="plum" size={70} />
          </View>
        </Animated.View>

        <View style={styles.bestPill} testID="title-best">
          <Ionicons name="trophy" size={16} color={COLORS.peach.btnTo} />
          <Text style={styles.bestText}>BEST {best}</Text>
        </View>

        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.actions}>
          <Pressable
            testID="play-button"
            onPress={() => router.push("/game")}
            style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={[COLORS.peach.btnFrom, COLORS.peach.btnTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.playInner}
            >
              <Ionicons name="play" size={26} color="#fff" />
              <Text style={styles.playText}>PLAY</Text>
            </LinearGradient>
          </Pressable>

          <View style={styles.row}>
            <Pressable
              testID="howto-button"
              onPress={() => router.push("/howto")}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Ionicons name="help-circle-outline" size={22} color={COLORS.ink} />
              <Text style={styles.secondaryText}>HOW TO PLAY</Text>
            </Pressable>
            <Pressable
              testID="ranking-button"
              onPress={() => router.push("/ranking")}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Ionicons name="podium-outline" size={22} color={COLORS.ink} />
              <Text style={styles.secondaryText}>RANKING</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sun: {
    position: "absolute",
    top: -120,
    alignSelf: "center",
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: "#FFFFFF",
    opacity: 0.5,
  },
  content: { flex: 1, alignItems: "center", justifyContent: "space-between" },
  header: { alignItems: "center" },
  kicker: {
    color: COLORS.inkSoft,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 4,
    marginBottom: 4,
  },
  title: {
    color: COLORS.ink,
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: 1,
  },
  subtitle: {
    color: COLORS.peach.btnTo,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 3,
    marginTop: 2,
  },
  cluster: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  bestPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  bestText: { color: COLORS.ink, fontWeight: "800", fontSize: 15 },
  actions: { width: "100%", alignItems: "center", gap: 14 },
  playBtn: {
    width: "100%",
    borderRadius: 22,
    shadowColor: COLORS.peach.btnShadow,
    shadowOpacity: 0.5,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  playInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 68,
    borderRadius: 22,
  },
  playText: { color: "#fff", fontSize: 24, fontWeight: "900", letterSpacing: 2 },
  row: { flexDirection: "row", gap: 12, width: "100%" },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#F3D9BC",
  },
  secondaryText: { color: COLORS.ink, fontWeight: "800", fontSize: 15 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
