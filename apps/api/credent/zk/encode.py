"""Encoding between Python values and the revenue_proof circuit's inputs and outputs."""

DAYS = 90


def prover_toml(daily: list[int], salt: str, threshold: int) -> str:
    if len(daily) != DAYS:
        raise ValueError(f"circuit expects exactly {DAYS} daily values, got {len(daily)}")
    if any(not isinstance(v, int) or v < 0 or v >= 2**64 for v in daily):
        raise ValueError("daily values must be u64")
    days = ", ".join(f'"{v}"' for v in daily)
    return f'daily = [{days}]\nsalt = "{salt}"\nthreshold = "{threshold}"\n'


def normalize_field_hex(h: str) -> str:
    return "0x" + format(int(h, 16), "064x")


def parse_public_inputs(buf: bytes) -> tuple[int, str]:
    """bb writes public inputs as 32-byte big-endian fields: [threshold, commitment]."""
    if len(buf) != 64:
        raise ValueError(f"expected 64 bytes of public inputs, got {len(buf)}")
    return int.from_bytes(buf[:32], "big"), "0x" + buf[32:].hex()
