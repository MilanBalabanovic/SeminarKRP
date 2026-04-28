from __future__ import annotations

import heapq
from typing import Dict, Optional, Set, Tuple

from .base import Node, SearchAlgorithm, SearchState


class EES(SearchAlgorithm):

    def _initialize(self) -> None:
        sr, sc = self.start
        start = Node(sr, sc, g=0)
        start.h    = self.heuristic(self.start, self.goal)
        start.hhat = self.hhat_fn(self.start, self.goal)
        start.dhat = self.dhat_fn(self.start, self.goal)
        start.f    = start.g + start.h
        start.fhat = start.g + start.hhat

        self._ctr: int = 0
        self.open_heap:  list = []
        self.open_dict:  Dict[Tuple[int, int], Node] = {}
        self.focal_heap: list = []
        self.focal_set:  Set[Tuple[int, int]] = set()
        self.closed:     Dict[Tuple[int, int], Node] = {}

        self._focal_threshold: float = 0.0

        self._push_open(start)
        self._push_focal(start)
        self._focal_threshold = self.weight * start.fhat

    def _push_open(self, node: Node) -> None:
        key = (node.row, node.col)
        self.open_dict[key] = node
        heapq.heappush(self.open_heap, (node.fhat, self._ctr, node))
        self._ctr += 1

    def _push_focal(self, node: Node) -> None:
        key = (node.row, node.col)
        self.focal_set.add(key)
        heapq.heappush(self.focal_heap, (node.dhat, self._ctr, node))
        self._ctr += 1

    def _peek_fhat_min(self) -> Optional[float]:
        while self.open_heap:
            fhat, _, node = self.open_heap[0]
            key = (node.row, node.col)
            if key in self.open_dict and self.open_dict[key] is node:
                return fhat
            heapq.heappop(self.open_heap)
        return None

    def _pop_open_best(self) -> Optional[Node]:
        while self.open_heap:
            _, _, node = heapq.heappop(self.open_heap)
            key = (node.row, node.col)
            if key in self.open_dict and self.open_dict[key] is node:
                del self.open_dict[key]
                self.focal_set.discard(key)
                return node
        return None

    def _pop_focal_best(self) -> Optional[Node]:
        while self.focal_heap:
            _, _, node = heapq.heappop(self.focal_heap)
            key = (node.row, node.col)
            if (
                key in self.focal_set
                and key in self.open_dict
                and self.open_dict[key] is node
            ):
                self.focal_set.discard(key)
                del self.open_dict[key]
                return node
        return None

    def _update_focal(self) -> None:
        fhat_min = self._peek_fhat_min()
        if fhat_min is None:
            return
        new_threshold = self.weight * fhat_min
        if new_threshold <= self._focal_threshold:
            return  # threshold can only grow; nothing new to add
        for key, node in self.open_dict.items():
            if key not in self.focal_set and node.fhat <= new_threshold:
                self._push_focal(node)
        self._focal_threshold = new_threshold

    def step(self) -> SearchState:
        if self.state.found or self.state.failed:
            return self.state

        if not self.open_dict:
            self.state.failed = True
            return self.state

        self._update_focal()

        # Prefer focal (best dhat); fall back to best fhat
        node = self._pop_focal_best() or self._pop_open_best()

        if node is None:
            self.state.failed = True
            return self.state

        key = (node.row, node.col)

        if key == self.goal:
            self.state.found     = True
            self.state.path      = self.reconstruct_path(node)
            self.state.path_cost = node.g
            self._sync_state(self.open_dict, self.closed, self.focal_set)
            return self.state

        self.closed[key] = node
        self.nodes_expanded += 1

        for nr, nc in self.get_neighbors(node):
            nkey = (nr, nc)
            if nkey in self.closed:
                continue
            new_g = node.g + 1

            if nkey in self.open_dict:
                existing = self.open_dict[nkey]
                if new_g < existing.g:
                    existing.g      = new_g
                    existing.f      = new_g + existing.h
                    existing.fhat   = new_g + existing.hhat
                    existing.parent = node
                    self._push_open(existing)
                    fhat_min = self._peek_fhat_min() or existing.fhat
                    if existing.fhat <= self.weight * fhat_min:
                        self._push_focal(existing)
            else:
                child = Node(nr, nc, g=new_g)
                child.h    = self.heuristic(nkey, self.goal)
                child.hhat = self.hhat_fn(nkey, self.goal)
                child.dhat = self.dhat_fn(nkey, self.goal)
                child.f    = new_g + child.h
                child.fhat = new_g + child.hhat
                child.parent = node
                self._push_open(child)
                fhat_min = self._peek_fhat_min() or child.fhat
                if child.fhat <= self.weight * fhat_min:
                    self._push_focal(child)

        self._sync_state(self.open_dict, self.closed, self.focal_set)
        return self.state
