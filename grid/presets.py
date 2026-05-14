"""
Handcrafted preset grids that showcase algorithm behavioral differences.

Each preset is designed so that different algorithms expand noticeably
different node sets, making them useful for live demos.
"""

from __future__ import annotations

from typing import Dict, List


def _make_grid(rows: int, cols: int, walls: list) -> List[List[int]]:
    g = [[0] * cols for _ in range(rows)]
    for r, c in walls:
        g[r][c] = 1
    return g


def _pack(grid: List[List[int]], rows: int, cols: int) -> Dict:
    return {
        "grid":  grid,
        "rows":  rows,
        "cols":  cols,
        "start": [0, 0],
        "goal":  [rows - 1, cols - 1],
    }


def _misleading_shortcut() -> Dict:
    """
    A horizontal wall splits the grid.  The only gap is on the far left (col 0),
    but the goal is in the bottom-right corner.  Greedy algorithms that rush
    toward the goal hit the wall and must backtrack; A* finds the gap earlier.
    """
    rows, cols = 15, 15
    walls = [(7, c) for c in range(1, cols)]   # wall at row 7, gap at col 0 only
    return _pack(_make_grid(rows, cols, walls), rows, cols)


def _bottleneck() -> Dict:
    """
    A vertical wall divides the grid left and right.
    The only crossing is a single cell near the bottom-right corner.
    Forces all paths through one chokepoint — compare how each algorithm
    explores before finding it.
    """
    rows, cols = 15, 20
    walls = [(r, 10) for r in range(rows - 2)]   # wall at col 10, gap at rows 13-14
    return _pack(_make_grid(rows, cols, walls), rows, cols)


def _snake() -> Dict:
    """
    Horizontal walls with alternating left/right gaps create a winding S-path.
    Greedy overshoots at each turn; bounded-suboptimal methods stay closer to
    the true shortest path.
    """
    rows, cols = 18, 20
    walls: list = []
    for wall_row, gap_col in [(3, cols - 1), (7, 0), (11, cols - 1), (15, 0)]:
        for c in range(cols):
            if c != gap_col:
                walls.append((wall_row, c))
    return _pack(_make_grid(rows, cols, walls), rows, cols)


def _open_arena() -> Dict:
    """
    No obstacles — all paths have the same cost.
    Reveals the pure expansion pattern of each algorithm on a flat landscape.
    """
    rows, cols = 20, 20
    return _pack([[0] * cols for _ in range(rows)], rows, cols)


PRESETS: Dict[str, Dict] = {
    "misleading_shortcut": {
        "label":       "Misleading Shortcut",
        "description": "Wall with far-left gap — greedy rushes into dead end",
        "grid_data":   _misleading_shortcut(),
    },
    "bottleneck": {
        "label":       "Bottleneck",
        "description": "Single-cell crossing — compare exploration before the gap",
        "grid_data":   _bottleneck(),
    },
    "snake": {
        "label":       "Snake Corridor",
        "description": "Winding S-path — greedy overshoots each turn",
        "grid_data":   _snake(),
    },
    "open_arena": {
        "label":       "Open Arena",
        "description": "No obstacles — pure expansion pattern comparison",
        "grid_data":   _open_arena(),
    },
}
