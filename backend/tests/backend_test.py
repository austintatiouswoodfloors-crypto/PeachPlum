"""Backend API tests for Plum Peach scoring service.

Covers:
- GET /api/                (health)
- POST /api/scores         (create, empty->Guest default, long->truncated, negative clamp)
- GET  /api/scores/top     (sorted desc, limit clamp, no _id leak)
- GET  /api/scores/rank    (rank/total computation)
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
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
        assert "message" in j and j["message"]


# ---------- Score creation ----------
class TestCreateScore:
    def test_create_basic(self, client):
        payload = {"name": "TEST_player", "score": 42}
        r = client.post(f"{API}/scores", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["name"] == "TEST_player"
        assert j["score"] == 42
        assert "id" in j and j["id"]
        assert "created_at" in j
        assert "_id" not in j

    def test_create_empty_name_defaults_to_guest(self, client):
        r = client.post(f"{API}/scores", json={"name": "   ", "score": 5}, timeout=15)
        assert r.status_code == 200
        # NEW: default must be English "Guest", not Japanese
        assert r.json()["name"] == "Guest"

    def test_create_missing_or_empty_name_defaults(self, client):
        r = client.post(f"{API}/scores", json={"name": "", "score": 1}, timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "Guest"

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
        payload = {"name": "TEST_persist2", "score": 99998}
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
        for name, s in [("TEST_a2", 10), ("TEST_b2", 500), ("TEST_c2", 200)]:
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

    def test_top_limit_respected(self, client):
        r = client.get(f"{API}/scores/top?limit=2", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) <= 2

    def test_top_limit_default(self, client):
        r = client.get(f"{API}/scores/top", timeout=15)
        assert r.status_code == 200
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
        client.post(f"{API}/scores", json={"name": "TEST_rank2", "score": 100}, timeout=15)
        r = client.get(f"{API}/scores/rank?score=10000000", timeout=15)
        assert r.status_code == 200
        assert r.json()["rank"] == 1

    def test_rank_missing_param(self, client):
        r = client.get(f"{API}/scores/rank", timeout=15)
        assert r.status_code in (400, 422)
