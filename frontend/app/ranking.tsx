import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/src/game/theme";
import { getTopScores, ScoreEntry } from "@/src/game/api";

const MEDALS = ["#F5C518", "#B8C0CC", "#CD7F42"];

export default function Ranking() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const rows = await getTopScores(50);
      setData(rows);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <LinearGradient colors={[COLORS.bgTop, COLORS.bgBottom]} style={styles.fill} testID="ranking-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="ranking-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>RANKING</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.peach.btnTo} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={COLORS.inkSoft} />
          <Text style={styles.emptyText}>Failed to load</Text>
          <Pressable testID="ranking-retry" onPress={onRefresh} style={styles.retrySmall}>
            <Text style={styles.retrySmallText}>Reload</Text>
          </Pressable>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="podium-outline" size={44} color={COLORS.inkSoft} />
          <Text style={styles.emptyText}>No scores yet</Text>
          <Text style={styles.emptySub}>Be the first to submit a score!</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.peach.btnTo} />
          }
          renderItem={({ item, index }) => {
            const medal = MEDALS[index];
            return (
              <View style={[styles.row, index < 3 && styles.topRow]} testID={`rank-row-${index}`}>
                <View style={[styles.rankBadge, medal ? { backgroundColor: medal } : undefined]}>
                  {index < 3 ? (
                    <Ionicons name="trophy" size={16} color="#fff" />
                  ) : (
                    <Text style={styles.rankNum}>{index + 1}</Text>
                  )}
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.score}>{item.score}</Text>
              </View>
            );
          }}
        />
      )}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  emptyText: { color: COLORS.ink, fontSize: 17, fontWeight: "800" },
  emptySub: { color: COLORS.inkSoft, fontSize: 14, fontWeight: "600" },
  retrySmall: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.peach.btnTo,
  },
  retrySmallText: { color: "#fff", fontWeight: "800" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  topRow: { borderWidth: 2, borderColor: "#FFE2B0" },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EADFD1",
    alignItems: "center",
    justifyContent: "center",
  },
  rankNum: { color: COLORS.ink, fontWeight: "900", fontSize: 15 },
  name: { flex: 1, color: COLORS.ink, fontSize: 16, fontWeight: "800" },
  score: { color: COLORS.peach.btnTo, fontSize: 22, fontWeight: "900" },
});
