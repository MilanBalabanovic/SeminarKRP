# Project for Search Algorithms for Planning with Bounded Suboptimality

An interactive web visualiser for bounded-suboptimal search algorithms.
Run multiple algorithm configurations side-by-side on the same maze and
compare their behaviour live, step-by-step.

## Algorithms included

| Key      | Name                       |
| -------- | -------------------------- |
| `astar`  | A\*                        |
| `greedy` | Greedy Best-First          |
| `wastar` | Weighted A* (wA*)          |
| `ees`    | Explicit Estimation Search |
| `focal`  | Focal Search               |

## Quick start

```bash
pip install -r requirements.txt
python main.py          # starts on http://127.0.0.1:8000
```

Open `http://127.0.0.1:8000` in your browser.

## Using the visualiser

### Configurations panel

Each configuration is an independent algorithm run on the same maze.

- **Add Configuration** — add another algorithm to compare; each gets its own canvas.
- **Algorithm** — pick from the dropdown (A\*, Greedy BFS, Weighted A\*, EES, Focal Search).
- **Weight w** — suboptimality bound (shown for wA\*, EES, Focal; hidden for A\* and Greedy).
- **ĥ inflation** — inadmissible heuristic scale factor (EES only); controls how aggressively
  the focal list is populated.

### Controls

| Button       | Action                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| **Step**     | Expand one node across all active configurations simultaneously.           |
| **Run**      | Auto-step at the configured speed; all configurations advance in parallel. |
| **Stop**     | Pause the auto-run.                                                        |
| **Reset**    | Clear all search states; keep the current maze and configurations.         |
| **New Maze** | Generate a new random maze (guaranteed solvable).                          |

### Grid settings

| Setting        | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| Rows / Cols    | Grid dimensions (5–40).                                        |
| Obstacle %     | Fraction of cells that become walls (0.0–0.6).                 |
| Edit obstacles | Check the box, then click any cell to toggle it as wall/empty. |

### Colour legend

| Colour     | Meaning       |
| ---------- | ------------- |
| Orange-red | Start (S)     |
| Purple     | Goal (G)      |
| Orange     | Focal list    |
| Gold       | Open list     |
| Sky blue   | Closed list   |
| Mint green | Solution path |
| Dark grey  | Obstacle      |
| Off-white  | Empty cell    |

### Per-canvas metrics

Each canvas shows inline metrics once a search is running:

| Metric   | Explanation                                                                    |
| -------- | ------------------------------------------------------------------------------ |
| Expanded | Total node expansions so far (lower = more efficient).                         |
| Cost     | g-value of the goal once found.                                                |
| Ratio    | found_cost / optimal_cost (1.0 = optimal; pre-computed via A\* at generation). |

## Use of AI

**Tool used:** Claude Code as an agentic harness.
**Usage:** Code generation only as an assistant for patterns and boilerplate. Also, for CSS and parts of the template HTML.

**Tool used:** Claude Code as an agentic harness.
**Usage:** Generation of README.md

**Tool used:** Github Copilot as a code line finisher.
**Usage:** Finishing lines of code to speed up development.

**What was not delegated to AI:** Planning, architecture, choice of search algorithms, choice of heuristics, presets, algorithm creation, web application wireframe.

## Note
Some parts of the project were changed before the deadline, however were not committed on time. This includes only changes to the Web app interface and choice of heuristics.
This is visible in the commit history.
