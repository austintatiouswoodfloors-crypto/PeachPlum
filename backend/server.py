from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, field_validator
from typing import List
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ------------------------- Models -------------------------
class ScoreCreate(BaseModel):
    name: str
    score: int

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            v = "Guest"
        return v[:16]

    @field_validator("score")
    @classmethod
    def clamp_score(cls, v: int) -> int:
        if v < 0:
            return 0
        return int(v)


class Score(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    score: int
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ------------------------- Routes -------------------------
@api_router.get("/")
async def root():
    return {"message": "Momo Sumomo API"}


@api_router.post("/scores", response_model=Score)
async def create_score(payload: ScoreCreate):
    score_obj = Score(name=payload.name, score=payload.score)
    await db.scores.insert_one(score_obj.model_dump())
    return score_obj


@api_router.get("/scores/top", response_model=List[Score])
async def get_top_scores(limit: int = 30):
    limit = max(1, min(limit, 100))
    docs = (
        await db.scores.find({}, {"_id": 0})
        .sort("score", -1)
        .limit(limit)
        .to_list(limit)
    )
    return [Score(**d) for d in docs]


@api_router.get("/scores/rank")
async def get_rank(score: int):
    """Return how many players scored strictly higher (rank = better+1)."""
    better = await db.scores.count_documents({"score": {"$gt": score}})
    total = await db.scores.count_documents({})
    return {"rank": better + 1, "total": total + 1}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
