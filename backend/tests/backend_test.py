"""Backend API tests for Momo Sumomo scoring service.

Covers:
- GET /api/                (health)
- POST /api/scores         (create with jp name, empty->default, long->truncated, negative clamp)
- GET  /api/scores/top     (sorted desc, limit clamp)
- GET  /api/scores/rank    (rank/total computation)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://cloba-mobile.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Health ----------
class TestHealth:
    def test_root(self, client):
        r = client.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "message" in j
        assert "Momo" in j["message"] or j["message"]


# ---------- Score creation ----------
class TestCreateScore:
    def test_create_japanese_name(self, client):
        payload = {"name": "TEST_プレイヤー", "score": 42}
        r = client.post(f"{API}/scores", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["name"] == "TEST_プレイヤー"
        assert j["score"] == 42
        assert "id" in j and j["id"]
        assert "created_at" in j
        assert "_id" not in j  # mongo _id must be excluded

    def test_create_empty_name_defaults(self, client):
        r = client.post(f"{API}/scores", json={"name": "   ", "score": 5}, timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "ゲスト"

    def test_create_name_truncated_to_16(self, client):
        long_name = "TEST_" + "A" * 40
        r = client.post(f"{API}/scores", json={"name": long_name, "score": 3}, timeout=15)
        assert r.status_code == 200
        assert len(r.json()["name"]) == 16
        assert r.json()["name"] == long_name[:16]

    def test_create_negative_score_clamped(self, client):
        r = client.post(f"{API}/scores", json={"name": "TEST_neg", "score": -10}, timeout=15)
        assert r.status_code == 200
        assert r.json()["score"] == 0

    def test_create_persists_and_appears_in_top(self, client):
        # unique large score to guarantee top placement
        payload = {"name": "TEST_persist", "score": 99999}
        r = client.post(f"{API}/scores", json=payload, timeout=15)
        assert r.status_code == 200
        created_id = r.json()["id"]

        r2 = client.get(f"{API}/scores/top?limit=100", timeout=15)
        assert r2.status_code == 200
        ids = [x["id"] for x in r2.json()]
        assert created_id in ids


# ---------- Top scores ----------
class TestTopScores:
    def test_top_sorted_desc(self, client):
        # seed a few
        for name, s in [("TEST_a", 10), ("TEST_b", 500), ("TEST_c", 200)]:
            client.post(f"{API}/scores", json={"name": name, "score": s}, timeout=15)
        r = client.get(f"{API}/scores/top?limit=50", timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 3
        scores = [row["score"] for row in rows]
        assert scores == sorted(scores, reverse=True)
        for row in rows:
            assert "_id" not in row
            assert isinstance(row["name"], str)
            assert isinstance(row["score"], int)

    def test_top_limit_clamped_and_respected(self, client):
        r = client.get(f"{API}/scores/top?limit=2", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) <= 2

    def test_top_limit_default(self, client):
        r = client.get(f"{API}/scores/top", timeout=15)
        assert r.status_code == 200
        # default is 30, but there could be fewer rows -> just ensure <=30
        assert len(r.json()) <= 30


# ---------- Rank ----------
class TestRank:
    def test_rank_shape(self, client):
        r = client.get(f"{API}/scores/rank?score=0", timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "rank" in j and "total" in j
        assert isinstance(j["rank"], int)
        assert isinstance(j["total"], int)
        assert j["rank"] >= 1
        assert j["total"] >= 1

    def test_rank_high_score_is_first(self, client):
        # Insert a huge value; rank query for very high score = 1
        client.post(f"{API}/scores", json={"name": "TEST_rank", "score": 100}, timeout=15)
        r = client.get(f"{API}/scores/rank?score=10_000_000", timeout=15)
        assert r.status_code == 200
        assert r.json()["rank"] == 1

    def test_rank_missing_param_400(self, client):
        r = client.get(f"{API}/scores/rank", timeout=15)
        # FastAPI returns 422 for missing required query param
        assert r.status_code in (400, 422)
