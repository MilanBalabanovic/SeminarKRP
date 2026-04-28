from __future__ import annotations

import heapq
from typing import Dict, Optional, Tuple

from .base import Node, SearchAlgorithm, SearchState


class GreedyBFS(SearchAlgorithm):
    """Greedy best-first search — open list sorted by h only."""

    def _initialize(self) -> None:
        sr, sc = self.start
        start = Node(sr, sc, g=0)
        start.h = self.heuristic(self.start, self.goal)
        start.f = start.h  # f ≡ h for greedy

        self._ctr: int = 0
        self.open_heap: list = []
        self.open_dict: Dict[Tuple[int, int], Node] = {}
        self.closed:    Dict[Tuple[int, int], Node] = {}

        self._push(start)

    def _push(self, node: Node) -> None:
        key = (node.row, node.col)
        self.open_dict[key] = node
        heapq.heappush(self.open_heap, (node.f, self._ctr, node))
        self._ctr += 1

    def _pop_best(self) -> Optional[Node]:
        while self.open_heap:
            _, _, node = heapq.heappop(self.open_heap)
            key = (node.row, node.col)
            if key in self.open_dict and self.open_dict[key] is node:
                del self.open_dict[key]
                return node
        return None

    def step(self) -> SearchState:
        if self.state.found or self.state.failed:
            return self.state

        node = self._pop_best()
        if node is None:
            self.state.failed = True
            return self.state

        key = (node.row, node.col)

        if key == self.goal:
            self.state.found     = True
            self.state.path      = self.reconstruct_path(node)
            self.state.path_cost = node.g
            self._sync_state(self.open_dict, self.closed)
            return self.state

        self.closed[key] = node
        self.nodes_expanded += 1

        for nr, nc in self.get_neighbors(node):
            nkey = (nr, nc)
            if nkey in self.closed or nkey in self.open_dict:
                continue
            child = Node(nr, nc, g=node.g + 1)
            child.h = self.heuristic(nkey, self.goal)
            child.f = child.h
            child.parent = node
            self._push(child)

        self._sync_state(self.open_dict, self.closed)
        return self.state
