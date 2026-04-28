from .astar import AStar
from .greedy import GreedyBFS
from .weighted_astar import WeightedAStar
from .ees import EES
from .focal_search import FocalSearch

ALGORITHM_MAP = {
    "astar":   AStar,
    "greedy":  GreedyBFS,
    "wastar":  WeightedAStar,
    "ees":     EES,
    "focal":   FocalSearch,
}
