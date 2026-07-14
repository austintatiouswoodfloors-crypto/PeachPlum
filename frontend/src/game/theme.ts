export const COLORS = {
  bgTop: "#FFF7EC",
  bgBottom: "#FFE6C7",
  ink: "#5A3620",
  inkSoft: "#9A7458",
  card: "#FFFFFF",
  peach: {
    hi: "#FFE29A",
    mid: "#F79338",
    edge: "#D63A18",
    spec: "#FFF6DE",
    btnFrom: "#FFB454",
    btnTo: "#F26D26",
    btnShadow: "#C1470F",
  },
  plum: {
    hi: "#C6506B",
    mid: "#7C1B31",
    edge: "#2C0712",
    spec: "#F2B9C6",
    btnFrom: "#9C2A44",
    btnTo: "#5C0F23",
    btnShadow: "#3C0715",
  },
};

export type FruitType = "peach" | "plum";

export const LABELS = {
  peach: { en: "PEACH" },
  plum: { en: "PLUM" },
};

// difficulty: time budget (ms) for the current fruit, shrinks with score.
export function durationForScore(score: number): number {
  return Math.max(430, 1500 - score * 22);
}
