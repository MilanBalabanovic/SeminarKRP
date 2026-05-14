"""
Heuristic functions for grid-world search.

All functions share the signature  f(pos, goal) -> float.
All listed heuristics are admissible on 4-connected unit-cost grids.
"""

from __future__ import annotations

import math
from typing import Callable, Optional, Tuple

Heuristic = Callable[[Tuple[int, int], Tuple[int, int]], float]


def manhattan(pos: Tuple[int, int], goal: Tuple[int, int]) -> float:
    return float(abs(pos[0] - goal[0]) + abs(pos[1] - goal[1]))


def euclidean(pos: Tuple[int, int], goal: Tuple[int, int]) -> float:
    dr = pos[0] - goal[0]
    dc = pos[1] - goal[1]
    return math.sqrt(dr * dr + dc * dc)


def chebyshev(pos: Tuple[int, int], goal: Tuple[int, int]) -> float:
    return float(max(abs(pos[0] - goal[0]), abs(pos[1] - goal[1])))


def octile(pos: Tuple[int, int], goal: Tuple[int, int]) -> float:
    """Diagonal distance — tighter than Chebyshev, looser than Manhattan."""
    dr = abs(pos[0] - goal[0])
    dc = abs(pos[1] - goal[1])
    return float(max(dr, dc) + (math.sqrt(2) - 1) * min(dr, dc))


def make_custom(expr: str) -> Heuristic:
    """
    Build a heuristic from a user expression.
    Variables: r = |row diff|, c = |col diff|.
    Functions: sqrt, min, max, abs, floor, ceil, pi.
    Example: sqrt(r*r + c*c)
    """
    _env: dict = {
        "__builtins__": {},
        "sqrt": math.sqrt, "min": min, "max": max, "abs": abs,
        "floor": math.floor, "ceil": math.ceil, "pi": math.pi,
    }
    compiled = compile(expr.strip(), "<heuristic>", "eval")

    def h(pos: Tuple[int, int], goal: Tuple[int, int]) -> float:
        dr = abs(pos[0] - goal[0])
        dc = abs(pos[1] - goal[1])
        return float(eval(compiled, {}, {**_env, "r": dr, "c": dc}))

    # Test a range of (r, c) combinations to surface runtime errors early.
    # Covers: r≠c, r==c (diagonal goal), r==0, c==0, and both==0.
    _samples = [(3, 4), (5, 5), (0, 6), (6, 0), (0, 0)]
    for dr, dc in _samples:
        try:
            result = h((0, 0), (dr, dc))
            if not math.isfinite(result):
                raise ValueError(f"must return a finite number (got {result!r} for r={dr}, c={dc})")
            if result < 0:
                raise ValueError(f"heuristic must be ≥ 0 (got {result!r} for r={dr}, c={dc})")
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError(f"{exc} (for r={dr}, c={dc})") from exc

    return h


HEURISTIC_MAP: dict = {
    "manhattan": manhattan,
    "euclidean": euclidean,
    "chebyshev": chebyshev,
    "octile":    octile,
}

HEURISTIC_LABELS: dict = {
    "manhattan": "Manhattan",
    "euclidean": "Euclidean",
    "chebyshev": "Chebyshev",
    "octile":    "Octile",
    "custom":    "Custom",
}


def make_hhat(inflation: float = 1.5, base_h: Optional[Heuristic] = None) -> Heuristic:
    """
    Return an inadmissible hhat = inflation * base_h.
    EES uses hhat to rank OPEN by fhat = g + hhat.
    """
    h = base_h if base_h is not None else manhattan

    def hhat(pos: Tuple[int, int], goal: Tuple[int, int]) -> float:
        return inflation * h(pos, goal)
    return hhat


def make_dhat(avg_edge_cost: float = 1.0) -> Heuristic:
    """
    Distance-to-go estimate. EES sorts FOCAL by dhat to prefer fewer steps.
    Uses Manhattan regardless of the chosen cost heuristic.
    """
    def dhat(pos: Tuple[int, int], goal: Tuple[int, int]) -> float:
        return manhattan(pos, goal) / max(avg_edge_cost, 1e-9)
    return dhat
