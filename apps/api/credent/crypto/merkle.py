import hashlib

EMPTY_ROOT = "0" * 64


def merkle_root(hashes: list[str]) -> str:
    """Binary SHA-256 Merkle root over hex leaves; odd levels duplicate the last node."""
    if not hashes:
        return EMPTY_ROOT
    level = list(hashes)
    while len(level) > 1:
        if len(level) % 2:
            level.append(level[-1])
        level = [
            hashlib.sha256(bytes.fromhex(a) + bytes.fromhex(b)).hexdigest()
            for a, b in zip(level[::2], level[1::2])
        ]
    return level[0]
