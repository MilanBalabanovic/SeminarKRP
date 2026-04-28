from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Callable, Dict, Generator, List, Optional, Set, Tuple


@dataclass
class Node:
    row: int
    col: int
    g: float = float("inf")
    h: float = 0.0
    f: float = 0.0
    hhat: float = 0.0
    dhat: float = 0.0
    fhat: float = 0.0
    parent: Optional[Node] = field(default=None, repr=False, compare=False)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Node):
            return NotImplemented
        return self.row == other.row and self.col == other.col

    def __hash__(self) -> int:
        return hash((self.row, self.col))

    def __lt__(self, other: Node) -> bool:
        return self.f < other.f


@dataclass
class SearchState:
    open_list: List = field(default_factory=list)
    focal_list: List = field(default_factory=list)
    closed_list: List = field(default_factory=list)
    path: List[Tuple[int, int]] = field(default_factory=list)
    found: bool = False
    failed: bool = False
    nodes_expanded: int = 0
    path_cost: float = 0.0

    def to_dict(self) -> dict:
        return {
            "open_list":      self.open_list,
            "focal_list":     self.focal_list,
            "closed_list":    [list(p) for p in self.closed_list],
            "path":           [list(p) for p in self.path],
            "found":          self.found,
            "failed":         self.failed,
            "nodes_expanded": self.nodes_expanded,
            "path_cost":      self.path_cost,
        }


Heuristic = Callable[[Tuple[int, int], Tuple[int, int]], float]


class SearchAlgorithm(ABC):
    def __init__(
        self,
        grid: List[List[int]],
        start: Tuple[int, int],
        goal: Tuple[int, int],
        heuristic: Heuristic,
        weight: float = 1.0,
        hhat_fn: Optional[Heuristic] = None,
        dhat_fn: Optional[Heuristic] = None,
    ) -> None:
        self.grid = grid
        self.rows = len(grid)
        self.cols = len(grid[0]) if grid else 0
        self.start = start
        self.goal = goal
        self.heuristic = heuristic
        self.weight = weight
        self.hhat_fn: Heuristic = hhat_fn if hhat_fn is not None else heuristic
        self.dhat_fn: Heuristic = dhat_fn if dhat_fn is not None else heuristic
        self.nodes_expanded: int = 0
        self.state = SearchState()
        self._initialize()

    @abstractmethod
    def _initialize(self) -> None: ...

    @abstractmethod
    def step(self) -> SearchState: ...

    def get_neighbors(self, node: Node) -> Generator[Tuple[int, int], None, None]:
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nr, nc = node.row + dr, node.col + dc
            if 0 <= nr < self.rows and 0 <= nc < self.cols and self.grid[nr][nc] == 0:
                yield (nr, nc)

    def reconstruct_path(self, node: Node) -> List[Tuple[int, int]]:
        path: List[Tuple[int, int]] = []
        cur: Optional[Node] = node
        while cur is not None:
            path.append((cur.row, cur.col))
            cur = cur.parent
        path.reverse()
        return path

    def _sync_state(
        self,
        open_dict: Dict[Tuple[int, int], Node],
        closed: Dict[Tuple[int, int], Node],
        focal_set: Optional[Set[Tuple[int, int]]] = None,
    ) -> None:
        focal = focal_set or set()
        self.state.open_list   = [[k[0], k[1], round(v.h, 1)] for k, v in open_dict.items()]
        self.state.focal_list  = [[k[0], k[1], round(open_dict[k].h, 1)] for k in focal if k in open_dict]
        self.state.closed_list = list(closed.keys())
        self.state.nodes_expanded = self.nodes_expanded
