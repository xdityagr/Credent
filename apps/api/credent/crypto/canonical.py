import json
from typing import Any


def canonical_json(obj: Any) -> str:
    """Deterministic JSON used for every hash and signature in Credent."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
