import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/src/game/theme";
import { FruitToken } from "@/src/game/FruitToken";

function Step({ n, jp, en }: { n: number; jp: string; en: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepJp}>{jp}</Text>
        <Text style={styles.stepEn}>{en}</Text>
      </View>
    </View>
  );
}

export default function HowTo() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.fill} testID="howto-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="howto-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>あそびかた</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.fruitsRow}>
          <View style={styles.fruitCard}>
            <FruitToken type="peach" size={78} />
            <Text style={styles.fruitName}>もも</Text>
            <Text style={styles.fruitNameEn}>PEACH</Text>
          </View>
          <View style={styles.fruitCard}>
            <FruitToken type="plum" size={78} />
            <Text style={styles.fruitName}>すもも</Text>
            <Text style={styles.fruitNameEn}>PLUM</Text>
          </View>
        </View>

        <Step
          n={1}
          jp="落ちてくる もも と すもも を、順番どおりにボタンで受けとろう。"
          en="Tap the matching button in the order the fruits arrive."
        />
        <Step
          n={2}
          jp="いちばん下のフルーツが今の目標。合うボタンを押すと消えるよ。"
          en="The bottom fruit is your current target — tap its button to clear it."
        />
        <Step
          n={3}
          jp="スピードはどんどん速くなる！ 時間切れに気をつけて。"
          en="Speed keeps increasing — don't let the timer bar run out."
        />
        <Step
          n={4}
          jp="間違って押したり、時間切れになったらゲームオーバー。"
          en="A wrong tap or a timeout ends the game."
        />

        <View style={styles.tip}>
          <Ionicons name="bulb" size={18} color={COLORS.peach.btnTo} />
          <Text style={styles.tipText}>
            ハイスコアはランキングに登録して、世界と競おう！
          </Text>
        </View>

        <Pressable
          testID="howto-play-button"
          onPress={() => router.replace("/game")}
          style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.9 }]}
        >
          <LinearGradient
            colors={[COLORS.peach.btnFrom, COLORS.peach.btnTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.playInner}
          >
            <Ionicons name="play" size={24} color="#fff" />
            <Text style={styles.playText}>あそぶ</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
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
  headerTitle: { color: COLORS.ink, fontSize: 22, fontWeight: "900" },
  fruitsRow: { flexDirection: "row", gap: 14, marginBottom: 20 },
  fruitCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  fruitName: { color: COLORS.ink, fontSize: 18, fontWeight: "900", marginTop: 6 },
  fruitNameEn: { color: COLORS.inkSoft, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  step: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  stepNum: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.peach.btnTo,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  stepJp: { color: COLORS.ink, fontSize: 15, fontWeight: "800", lineHeight: 21 },
  stepEn: { color: COLORS.inkSoft, fontSize: 12, fontWeight: "600", marginTop: 3 },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF3DF",
    borderRadius: 16,
    padding: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  tipText: { flex: 1, color: COLORS.ink, fontWeight: "700", fontSize: 13, lineHeight: 19 },
  playBtn: {
    borderRadius: 20,
    shadowColor: COLORS.peach.btnShadow,
    shadowOpacity: 0.5,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  playInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 62,
    borderRadius: 20,
  },
  playText: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: 2 },
});
