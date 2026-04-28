"""
FastAPI backend for the grid-world search visualiser.

Endpoints
---------
GET  /                         Serve the frontend SPA
POST /api/grid/generate        Generate a random maze + compute A* optimal cost
POST /api/grid/toggle          Toggle a cell obstacle on/off
POST /api/search/init          Initialise a search session
POST /api/search/step          Expand one node; return updated state
POST /api/search/run           Run to completion; return final state
GET  /api/search/state/{sid}   Return current state for a session

Session management is in-memory (dict keyed by UUID string).  Sessions are
cheap — there is no cleanup needed for a local demo tool.
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from algorithms import ALGORITHM_MAP
from algorithms.astar import AStar
from grid.heuristics import make_dhat, make_hhat, manhattan
from grid.world import GridWorld

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Grid-World Search Visualiser", version="1.0")

# Serve the frontend
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", include_in_schema=False)
def root() -> FileResponse:
    return FileResponse("static/index.html")


# ---------------------------------------------------------------------------
# In-memory session store
# ---------------------------------------------------------------------------

_sessions: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Pydantic request/response schemas
# ---------------------------------------------------------------------------

class GridConfig(BaseModel):
    rows: int = Field(15, ge=5, le=40)
    cols: int = Field(15, ge=5, le=40)
    obstacle_density: float = Field(0.28, ge=0.0, le=0.6)
    seed: Optional[int] = None


class ToggleRequest(BaseModel):
    grid_data: Dict
    row: int
    col: int


class SearchConfig(BaseModel):
    grid_data: Dict
    algorithm: str = "astar"          # key from ALGORITHM_MAP
    weight: float = Field(1.5, ge=1.0, le=10.0)
    hhat_inflation: float = Field(1.5, ge=1.0, le=5.0)


class StepRequest(BaseModel):
    session_id: str


class RunRequest(BaseModel):
    session_id: str
    max_steps: int = Field(50_000, ge=1)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_algo(config: SearchConfig):
    """Instantiate the requested search algorithm from a SearchConfig."""
    grid      = config.grid_data["grid"]
    start     = tuple(config.grid_data["start"])
    goal      = tuple(config.grid_data["goal"])
    hhat_fn   = make_hhat(config.hhat_inflation)
    dhat_fn   = make_dhat(avg_edge_cost=1.0)

    cls = ALGORITHM_MAP.get(config.algorithm)
    if cls is None:
        raise HTTPException(status_code=400, detail=f"Unknown algorithm '{config.algorithm}'")

    return cls(
        grid=grid,
        start=start,
        goal=goal,
        heuristic=manhattan,
        weight=config.weight,
        hhat_fn=hhat_fn,
        dhat_fn=dhat_fn,
    )


def _compute_optimal_cost(grid_data: Dict) -> float:
    """
    Silently run A* to completion and return the optimal path cost.
    Returns inf if no path exists.
    """
    grid  = grid_data["grid"]
    start = tuple(grid_data["start"])
    goal  = tuple(grid_data["goal"])
    algo  = AStar(grid=grid, start=start, goal=goal, heuristic=manhattan)
    for _ in range(200_000):
        state = algo.step()
        if state.found:
            return state.path_cost
        if state.failed:
            break
    return float("inf")


def _state_response(session: Dict) -> Dict:
    """Build the JSON response dict for a session's current state."""
    state         = session["algo"].state
    optimal_cost  = session["optimal_cost"]
    elapsed       = time.time() - session["start_time"]

    subopt_ratio: Optional[float] = None
    if state.found and optimal_cost < float("inf") and optimal_cost > 0:
        subopt_ratio = round(state.path_cost / optimal_cost, 4)

    return {
        **state.to_dict(),
        "elapsed":       round(elapsed, 3),
        "optimal_cost":  optimal_cost if optimal_cost < float("inf") else None,
        "subopt_ratio":  subopt_ratio,
        "session_id":    session["session_id"],
        "algorithm":     session["algorithm"],
        "weight":        session["weight"],
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/grid/generate")
def generate_grid(cfg: GridConfig) -> Dict:
    """
    Generate a random maze that is guaranteed to have a path from S to G.
    Also pre-computes the A* optimal cost for suboptimality ratio display.
    """
    world = GridWorld(cfg.rows, cfg.cols, cfg.obstacle_density)
    grid_data = world.generate_random(cfg.seed)
    optimal_cost = _compute_optimal_cost(grid_data)
    return {
        **grid_data,
        "optimal_cost": optimal_cost if optimal_cost < float("inf") else None,
    }


@app.post("/api/grid/toggle")
def toggle_cell(req: ToggleRequest) -> Dict:
    """Flip one cell between empty and obstacle; returns updated grid_data."""
    world = GridWorld()
    world.from_dict(req.grid_data)
    world.toggle_cell(req.row, req.col)
    grid_data = world.to_dict()
    optimal_cost = _compute_optimal_cost(grid_data)
    return {
        **grid_data,
        "optimal_cost": optimal_cost if optimal_cost < float("inf") else None,
    }


@app.post("/api/search/init")
def init_search(cfg: SearchConfig) -> Dict:
    """
    Create a new search session.  Returns session_id and the initial state
    (start node on the open list, nothing expanded yet).
    """
    algo = _build_algo(cfg)
    sid  = str(uuid.uuid4())

    # Reuse optimal cost embedded in grid_data if frontend passed it,
    # otherwise compute it now.
    optimal_cost = cfg.grid_data.get("optimal_cost")
    if optimal_cost is None:
        optimal_cost = _compute_optimal_cost(cfg.grid_data)

    session: Dict[str, Any] = {
        "session_id":   sid,
        "algo":         algo,
        "grid_data":    cfg.grid_data,
        "start_time":   time.time(),
        "optimal_cost": float(optimal_cost) if optimal_cost is not None else float("inf"),
        "algorithm":    cfg.algorithm,
        "weight":       cfg.weight,
    }
    _sessions[sid] = session
    return _state_response(session)


@app.post("/api/search/step")
def step_search(req: StepRequest) -> Dict:
    """Expand exactly one node and return the updated state."""
    session = _sessions.get(req.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    session["algo"].step()
    return _state_response(session)


@app.post("/api/search/run")
def run_search(req: RunRequest) -> Dict:
    """
    Run the algorithm until it finds a path (or fails), up to max_steps.
    Returns the final state.
    """
    session = _sessions.get(req.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    algo = session["algo"]
    for _ in range(req.max_steps):
        state = algo.step()
        if state.found or state.failed:
            break

    return _state_response(session)


@app.get("/api/search/state/{session_id}")
def get_state(session_id: str) -> Dict:
    """Return the current state of an existing session."""
    session = _sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return _state_response(session)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
