"""
Benchmark — run all six algorithms on N random grids and print a comparison table.

Usage
-----
    python benchmark.py                       # defaults
    python benchmark.py --grids 20 --weight 2.0
    python benchmark.py --rows 20 --cols 20 --grids 10 --weight 1.5
    python benchmark.py --csv results.csv     # also export to CSV

Output columns
--------------
    Algorithm      name + weight
    Avg Expanded   average nodes expanded per grid
    Avg Cost       average path cost (inf-paths excluded)
    Avg Ratio      average suboptimality ratio (cost / A* cost)
    Found %        percentage of grids where a path was found
    Avg Time(ms)   average wall-clock time per grid in milliseconds
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from typing import Dict, List, Optional

from algorithms.astar             import AStar
from algorithms.greedy            import GreedyBFS
from algorithms.weighted_astar    import WeightedAStar
from algorithms.ees               import EES
from algorithms.dps               import DPS
from algorithms.alternating_queue import AlternatingQueue
from grid.heuristics              import make_dhat, make_hhat, manhattan
from grid.world                   import GridWorld


# ---------------------------------------------------------------------------
# Single-run helper
# ---------------------------------------------------------------------------

def run_algo(
    cls,
    grid_data: Dict,
    weight: float = 1.5,
    hhat_inflation: float = 1.5,
    max_steps: int = 200_000,
) -> Dict:
    """Run *cls* to completion on *grid_data*.  Returns result dict."""
    grid    = grid_data["grid"]
    start   = tuple(grid_data["start"])
    goal    = tuple(grid_data["goal"])
    hhat_fn = make_hhat(hhat_inflation)
    dhat_fn = make_dhat(avg_edge_cost=1.0)

    algo = cls(
        grid=grid, start=start, goal=goal,
        heuristic=manhattan, weight=weight,
        hhat_fn=hhat_fn, dhat_fn=dhat_fn,
    )

    t0 = time.perf_counter()
    for _ in range(max_steps):
        state = algo.step()
        if state.found or state.failed:
            break
    elapsed = time.perf_counter() - t0

    return {
        "found":    state.found,
        "expanded": state.nodes_expanded,
        "cost":     state.path_cost if state.found else float("inf"),
        "time_ms":  elapsed * 1000,
    }


# ---------------------------------------------------------------------------
# Benchmark runner
# ---------------------------------------------------------------------------

def benchmark(
    num_grids: int = 10,
    rows: int = 15,
    cols: int = 15,
    density: float = 0.28,
    weight: float = 1.5,
    hhat_inflation: float = 1.5,
    csv_path: Optional[str] = None,
) -> None:

    algorithms = [
        ("A*",                   AStar,            1.0),
        ("Greedy BFS",           GreedyBFS,        1.0),
        (f"wA*(w={weight:.2f})", WeightedAStar,    weight),
        (f"EES(w={weight:.2f})", EES,              weight),
        (f"DPS(w={weight:.2f})", DPS,              weight),
        (f"AltQ(w={weight:.2f})",AlternatingQueue, weight),
    ]

    print(f"\nBenchmark  |  {num_grids} grids  "
          f"|  {rows}x{cols}  |  density={density:.2f}  |  w={weight:.2f}")
    print("=" * 80)

    # Pre-compute grids and A* costs
    grids: List[Dict] = []
    astar_costs: List[float] = []
    sys.stdout.write("Generating grids and computing A* baselines… ")
    sys.stdout.flush()
    for i in range(num_grids):
        world = GridWorld(rows, cols, density)
        gd = world.generate_random(seed=i * 137)
        grids.append(gd)
        res = run_algo(AStar, gd, weight=1.0)
        astar_costs.append(res["cost"] if res["found"] else float("inf"))
    print("done.\n")

    # Run all algorithms
    all_results: List[Dict] = []
    col_w = 22

    header = (
        f"{'Algorithm':<{col_w}} "
        f"{'Avg Expanded':>14} "
        f"{'Avg Cost':>10} "
        f"{'Avg Ratio':>11} "
        f"{'Found %':>8} "
        f"{'Avg Time(ms)':>13}"
    )
    print(header)
    print("-" * len(header))

    for name, cls, w in algorithms:
        runs = []
        for gd in grids:
            runs.append(run_algo(cls, gd, weight=w, hhat_inflation=hhat_inflation))

        found_runs  = [r for r in runs if r["found"]]
        avg_exp     = sum(r["expanded"] for r in runs) / len(runs)
        avg_cost    = (sum(r["cost"] for r in found_runs) / len(found_runs)
                       if found_runs else float("inf"))
        found_pct   = 100 * len(found_runs) / len(runs)
        avg_time    = sum(r["time_ms"] for r in runs) / len(runs)

        # Suboptimality ratio vs A* baseline
        ratios = []
        for r, a_cost in zip(runs, astar_costs):
            if r["found"] and a_cost < float("inf") and a_cost > 0:
                ratios.append(r["cost"] / a_cost)
        avg_ratio = sum(ratios) / len(ratios) if ratios else float("nan")

        row = {
            "algorithm": name,
            "avg_expanded": avg_exp,
            "avg_cost":     avg_cost,
            "avg_ratio":    avg_ratio,
            "found_pct":    found_pct,
            "avg_time_ms":  avg_time,
        }
        all_results.append(row)

        ratio_str = f"{avg_ratio:.3f}" if avg_ratio == avg_ratio else "N/A"
        cost_str  = f"{avg_cost:.1f}"  if avg_cost < float("inf") else "N/A"
        print(
            f"{name:<{col_w}} "
            f"{avg_exp:>14.1f} "
            f"{cost_str:>10} "
            f"{ratio_str:>11} "
            f"{found_pct:>7.0f}% "
            f"{avg_time:>13.2f}"
        )

    print()

    # Optional CSV export
    if csv_path:
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(all_results[0].keys()))
            writer.writeheader()
            writer.writerows(all_results)
        print(f"Results written to {csv_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Benchmark all search algorithms")
    parser.add_argument("--grids",    type=int,   default=10,   help="Number of random grids")
    parser.add_argument("--rows",     type=int,   default=15,   help="Grid rows")
    parser.add_argument("--cols",     type=int,   default=15,   help="Grid cols")
    parser.add_argument("--density",  type=float, default=0.28, help="Obstacle density (0–0.6)")
    parser.add_argument("--weight",   type=float, default=1.5,  help="Suboptimality bound w")
    parser.add_argument("--hhat",     type=float, default=1.5,  help="ĥ inflation for EES")
    parser.add_argument("--csv",      type=str,   default=None, help="Export results to CSV file")
    args = parser.parse_args()

    benchmark(
        num_grids=args.grids,
        rows=args.rows,
        cols=args.cols,
        density=args.density,
        weight=args.weight,
        hhat_inflation=args.hhat,
        csv_path=args.csv,
    )
