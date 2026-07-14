import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS, FruitType } from "./theme";

type Props = {
  type: FruitType;
  size: number;
};

/**
 * A glossy fruit "bead" rendered purely with React Native views + a linear
 * gradient so it works everywhere (native + web preview). Peach shows a leaf
 * and warm tones; plum is a deep glossy maroon sphere.
 */
export function FruitToken({ type, size }: Props) {
  const c = COLORS[type];
  const r = size / 2;

  return (
    <View style={{ width: size, height: size }} testID={`fruit-${type}`}>
      {type === "peach" && (
        <View
          pointerEvents="none"
          style={[
            styles.leaf,
            {
              top: -size * 0.06,
              left: size * 0.46,
              width: size * 0.36,
              height: size * 0.2,
              borderTopLeftRadius: size * 0.2,
              borderBottomRightRadius: size * 0.22,
            },
          ]}
        />
      )}
      <View
        style={[
          styles.ball,
          {
            width: size,
            height: size,
            borderRadius: r,
            backgroundColor: c.edge,
          },
        ]}
      >
        <LinearGradient
          colors={[c.hi, c.mid, c.edge]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.26, y: 0.16 }}
          end={{ x: 0.86, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* cleft / crease */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: size * 0.04,
            bottom: size * 0.04,
            left: size * 0.485,
            width: size * 0.05,
            backgroundColor: "rgba(0,0,0,0.14)",
            borderRadius: size,
          }}
        />
        {/* specular highlight */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: size * 0.12,
            left: size * 0.2,
            width: size * 0.34,
            height: size * 0.22,
            borderRadius: size,
            backgroundColor: c.spec,
            opacity: 0.8,
            transform: [{ rotate: "-22deg" }],
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ball: {
    overflow: "hidden",
    shadowColor: "#3a1e0e",
    shadowOpacity: 0.28,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  leaf: {
    position: "absolute",
    zIndex: 2,
    backgroundColor: "#57A63B",
    transform: [{ rotate: "-38deg" }],
  },
});
