const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export type ScoreEntry = {
  id: string;
  name: string;
  score: number;
  created_at: string;
};

export async function submitScore(name: string, score: number): Promise<ScoreEntry> {
  const res = await fetch(`${BASE}/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, score }),
  });
  if (!res.ok) throw new Error("submit failed");
  return res.json();
}

export async function getTopScores(limit = 30): Promise<ScoreEntry[]> {
  const res = await fetch(`${BASE}/scores/top?limit=${limit}`);
  if (!res.ok) throw new Error("fetch failed");
  return res.json();
}

export async function getRank(score: number): Promise<{ rank: number; total: number }> {
  const res = await fetch(`${BASE}/scores/rank?score=${score}`);
  if (!res.ok) throw new Error("rank failed");
  return res.json();
}
