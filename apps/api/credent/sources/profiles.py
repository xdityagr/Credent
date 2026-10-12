"""Seeded business revenue profiles. These stand in for a live Stripe/bank feed."""

import math
import random
from dataclasses import dataclass


@dataclass(frozen=True)
class Profile:
    key: str
    label: str
    description: str
    base_daily: int  # cents
    weekly_amp: float
    seasonal_amp: float
    noise: float
    trend_per_day: float
    collapse_factor: float = 1.0


PROFILES: dict[str, Profile] = {
    p.key: p
    for p in [
        Profile("saas", "Subscription software", "Steady B2B SaaS revenue with mild growth",
                6_000_00, 0.05, 0.03, 0.08, 0.0015),
        Profile("ecommerce", "Seasonal e-commerce", "Direct-to-consumer sales with weekly and seasonal swings",
                8_000_00, 0.25, 0.30, 0.25, 0.0008),
        Profile("distressed", "Concentrated freight broker",
                "Healthy until its anchor client leaves, three weeks after funding",
                5_000_00, 0.10, 0.05, 0.10, 0.0, collapse_factor=0.12),
    ]
}


def _rng(seed: int, day: int) -> random.Random:
    return random.Random(f"{seed}:{day}")


def daily_revenue(profile: Profile, seed: int, start_day: int, days: int,
                  collapse_day: int | None = None) -> list[int]:
    out = []
    for day in range(start_day, start_day + days):
        r = _rng(seed, day)
        v = profile.base_daily
        v *= 1 + profile.trend_per_day * day
        v *= 1 + profile.weekly_amp * math.sin(2 * math.pi * day / 7)
        v *= 1 + profile.seasonal_amp * math.sin(2 * math.pi * day / 90)
        v *= 1 + profile.noise * (2 * r.random() - 1)
        if collapse_day is not None and day >= collapse_day:
            v *= profile.collapse_factor
        out.append(max(1, int(v)))
    return out


def split_payments(amount: int, rng: random.Random) -> list[int]:
    """Split a daily total into 1-4 positive customer payments that sum exactly."""
    n = min(amount, rng.randint(1, 4))
    cuts = sorted(rng.sample(range(1, amount), n - 1)) if n > 1 else []
    bounds = [0, *cuts, amount]
    return [b - a for a, b in zip(bounds, bounds[1:])]


def payments_for_day(profile: Profile, seed: int, day: int,
                     collapse_day: int | None = None) -> list[int]:
    total = daily_revenue(profile, seed, day, 1, collapse_day)[0]
    return split_payments(total, _rng(seed, day * 7919))
