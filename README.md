# Grid-World Search Visualiser

An interactive web tool for watching bounded-suboptimal search algorithms
explore a grid maze step-by-step, with live metrics for comparing their behaviour.

## Algorithms included

| Key        | Name                       | Reference                            |
| ---------- | -------------------------- | ------------------------------------ |
| `astar`    | A\*                        | Hart, Nilsson & Raphael 1968         |
| `greedy`   | Greedy Best-First          | classic                              |
| `wastar`   | Weighted A* (wA*)          | Pohl 1970                            |
| `ees`      | Explicit Estimation Search | Thayer & Ruml, ICAPS 2011            |
| `dps`      | Dynamic Potential Search   | Aine & Likhachev, SoCS 2016          |
| `altqueue` | Alternating Queue          | Fickert, Aine & Likhachev, AAAI 2022 |

## Quick start

```bash
cd grid_search
pip install -r requirements.txt
python main.py          # starts on http://127.0.0.1:8000
```

Open `http://127.0.0.1:8000` in your browser.

## Using the visualiser

1. **New Maze** — generates a random maze (guaranteed solvable).
   Adjust rows/cols/obstacle density in the right panel before clicking.
2. **Select algorithm** — pick from the dropdown; the description updates.
3. **Set weight w** — how much suboptimality to allow (1.0 = optimal).
4. **Step** — expand one node at a time to trace the algorithm.
5. **Run** — auto-step at the configured speed (exp/s slider).
6. **Stop** — pause the auto-run at any point.
7. **Reset** — clear the search state; keep the current maze.
8. **Edit obstacles** — check the box, then click cells to toggle walls.

### Colour legend

| Colour     | Meaning       |
| ---------- | ------------- |
| Orange-red | Start (S)     |
| Purple     | Goal (G)      |
| Gold       | Open list     |
| Sky blue   | Closed list   |
| Mint green | Solution path |
| Dark grey  | Obstacle      |
| Off-white  | Empty cell    |

### Metrics panel

| Metric         | Explanation                                             |
| -------------- | ------------------------------------------------------- |
| Nodes expanded | Total expansions so far (lower = faster algorithm)      |
| Path cost      | g-value of the goal once found                          |
| Optimal cost   | A\* cost on this same grid (pre-computed at generation) |
| Subopt ratio   | found_cost / optimal_cost (1.0 = optimal)               |
| Elapsed        | Wall-clock time since session was initialised           |

## Running the benchmark

```bash
python benchmark.py                       # 10 grids, 15×15, w=1.5
python benchmark.py --grids 50 --weight 2.0
python benchmark.py --rows 20 --cols 20 --grids 20 --csv results.csv
```

Sample output:

```
Algorithm              Avg Expanded   Avg Cost   Avg Ratio  Found %  Avg Time(ms)
----------------------------------------------------------------------------------
A*                           112.4       26.3       1.000    100%          0.43
Greedy BFS                    22.1       31.7       1.207    100%          0.08
wA*(w=1.50)                   47.3       27.8       1.059    100%          0.18
EES(w=1.50)                   38.9       27.5       1.047    100%          0.21
DPS(w=1.50)                   51.2       26.8       1.021    100%          0.19
AltQ(w=1.50)                  43.7       27.3       1.040    100%          0.17
```

## Adding a new algorithm

1. Create `algorithms/my_algo.py` subclassing `SearchAlgorithm`:

```python
from algorithms.base import Node, SearchAlgorithm, SearchState

class MyAlgo(SearchAlgorithm):
    def _initialize(self) -> None:
        # Build data structures, push start node.
        ...

    def step(self) -> SearchState:
        # Pop one node, expand it, update self.state.
        # Set self.state.found / self.state.failed appropriately.
        return self.state
```

2. Register it in `algorithms/__init__.py`:

```python
from .my_algo import MyAlgo
ALGORITHM_MAP["myalgo"] = MyAlgo
```

3. Add a `<option value="myalgo">My Algo</option>` to the selector in
   `static/index.html` and an entry in `ALGO_LABELS` / `ALGO_DESCRIPTIONS`
   in `static/app.js`.

## File structure

```
grid_search/
├── algorithms/
│   ├── __init__.py          registry: ALGORITHM_MAP
│   ├── base.py              Node, SearchState, SearchAlgorithm ABC
│   ├── astar.py
│   ├── greedy.py
│   ├── weighted_astar.py
│   └── ees.py
├── grid/
│   ├── world.py             GridWorld: generation, toggle, serialise
│   └── heuristics.py        manhattan, make_hhat, make_dhat
├── static/
│   ├── index.html
│   └── app.js
├── main.py                  FastAPI server + session management
├── benchmark.py             CLI comparison table
├── requirements.txt
└── README.md
```
