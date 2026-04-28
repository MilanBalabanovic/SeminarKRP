"""
GridWorld — random maze generation and serialisation.

Grid cell values
    0  EMPTY    passable
    1  OBSTACLE impassable

Start is always (0, 0); goal is always (rows-1, cols-1).
Obstacles are placed uniformly at random, then a BFS reachability
check ensures at least one path exists; if not, a new seed is tried.
"""

from __future__ import annotations

import random
from collections import deque
from typing import Dict, List, Optional, Tuple


class GridWorld:
    EMPTY = 0
    OBSTACLE = 1

    def __init__(
        self,
        rows: int = 15,
        cols: int = 15,
        obstacle_density: float = 0.28,
    ) -> None:
        self.rows = rows
        self.cols = cols
        self.obstacle_density = obstacle_density
        self.grid: List[List[int]] = [[0] * cols for _ in range(rows)]
        self.start: Tuple[int, int] = (0, 0)
        self.goal: Tuple[int, int] = (rows - 1, cols - 1)

    # ------------------------------------------------------------------
    # Generation
    # ------------------------------------------------------------------

    def generate_random(self, seed: Optional[int] = None) -> Dict:
        """
        Fill the grid with random obstacles, retrying until a path exists.

        A fixed seed produces a deterministic maze for reproducible demos.
        Returns the serialised grid dict (same format as to_dict()).
        """
        attempt = 0
        base_seed = seed if seed is not None else random.randint(0, 2**31)

        while True:
            rng = random.Random(base_seed + attempt)
            self.grid = [
                [
                    self.OBSTACLE if (r, c) not in (self.start, self.goal)
                    and rng.random() < self.obstacle_density
                    else self.EMPTY
                    for c in range(self.cols)
                ]
                for r in range(self.rows)
            ]
            if self._path_exists():
                break
            attempt += 1
            if attempt > 1000:
                # Fallback: clear the grid entirely
                self.grid = [[self.EMPTY] * self.cols for _ in range(self.rows)]
                break

        return self.to_dict()

    def _path_exists(self) -> bool:
        """BFS reachability check from start to goal."""
        visited = {self.start}
        queue: deque[Tuple[int, int]] = deque([self.start])
        while queue:
            r, c = queue.popleft()
            if (r, c) == self.goal:
                return True
            for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nr, nc = r + dr, c + dc
                if (
                    0 <= nr < self.rows
                    and 0 <= nc < self.cols
                    and (nr, nc) not in visited
                    and self.grid[nr][nc] == self.EMPTY
                ):
                    visited.add((nr, nc))
                    queue.append((nr, nc))
        return False

    # ------------------------------------------------------------------
    # Serialisation
    # ------------------------------------------------------------------

    def to_dict(self) -> Dict:
        return {
            "grid":  self.grid,
            "rows":  self.rows,
            "cols":  self.cols,
            "start": list(self.start),
            "goal":  list(self.goal),
        }

    def from_dict(self, data: Dict) -> None:
        self.rows  = data["rows"]
        self.cols  = data["cols"]
        self.grid  = data["grid"]
        self.start = tuple(data["start"])   # type: ignore[assignment]
        self.goal  = tuple(data["goal"])    # type: ignore[assignment]

    # ------------------------------------------------------------------
    # Manual editing helpers (used by the frontend toggle endpoint)
    # ------------------------------------------------------------------

    def toggle_cell(self, row: int, col: int) -> None:
        """Flip a cell between EMPTY and OBSTACLE (start/goal protected)."""
        if (row, col) in (self.start, self.goal):
            return
        self.grid[row][col] = (
            self.OBSTACLE if self.grid[row][col] == self.EMPTY else self.EMPTY
        )
