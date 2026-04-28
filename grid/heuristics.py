"""
Heuristic functions for grid-world search.

All functions share the signature  f(pos, goal) -> float
so they can be passed uniformly to any SearchAlgorithm.
"""

from __future__ import annotations

from typing import Tuple


def manhattan(pos: Tuple[int, int], goal: Tuple[int, int]) -> float:
    """
    Admissible Manhattan-distance heuristic.

    For a 4-connected grid with uniform edge cost = 1 this is both
    admissible (never over-estimates) and consistent (monotone).
    """
    return float(abs(pos[0] - goal[0]) + abs(pos[1] - goal[1]))


def make_hhat(inflation: float = 1.5) -> Tuple:
    """
    Return an inadmissible hhat function.

    hhat(n) = inflation * manhattan(n, goal)

    Using inflation > 1 intentionally over-estimates the remaining cost.
    EES uses hhat to rank nodes in OPEN (by fhat = g + hhat) so that
    nodes believed to be closer to the goal rise to the top faster than
    pure A* ordering would suggest — at the price of the optimality guarantee.

    Args:
        inflation: multiplier on the admissible h (default 1.5)
    """
    def hhat(pos: Tuple[int, int], goal: Tuple[int, int]) -> float:
        return inflation * manhattan(pos, goal)
    hhat.__doc__ = f"Inadmissible hhat with inflation={inflation}"
    return hhat


def make_dhat(avg_edge_cost: float = 1.0) -> Tuple:
    """
    Return a distance-to-go (dhat) estimator.

    dhat(n) = manhattan(n, goal) / avg_edge_cost

    For uniform-cost grids (edge cost = 1) this equals manhattan distance,
    but the function is parameterised so it generalises to weighted graphs.
    EES sorts its FOCAL list by dhat to prefer nodes estimated to reach
    the goal in fewer *steps* — a different signal from cost-to-go.

    Args:
        avg_edge_cost: assumed average cost per edge (default 1.0)
    """
    def dhat(pos: Tuple[int, int], goal: Tuple[int, int]) -> float:
        return manhattan(pos, goal) / max(avg_edge_cost, 1e-9)
    dhat.__doc__ = f"Distance-to-go dhat with avg_edge_cost={avg_edge_cost}"
    return dhat
