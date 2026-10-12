"""Rebuild an in-process (CHAIN_MODE=local) chain from the database after a restart.

LiteSVM keeps state in memory. The database already records every confirmed
token movement (server transfers and wallet-signed deposits), so on boot we
recompute each owner's cUSD balance and mint it back. Devnet never needs this.
"""

from collections import defaultdict

from sqlmodel import Session, select

from credent.chain.service import ChainService, Leg, legs_from_json
from credent.models import ChainTransfer, DepositIntent, Pool


def expected_balances(s: Session) -> dict[str, int]:
    bal: dict[str, int] = defaultdict(int)
    for t in s.exec(select(ChainTransfer).where(ChainTransfer.status == "CONFIRMED")):
        for leg in legs_from_json(t.legs_json):
            if leg.src != "mint":
                bal[leg.src] -= leg.amount
            bal[leg.dst] += leg.amount
    for d in s.exec(select(DepositIntent).where(DepositIntent.status.in_(["CONFIRMED", "CREDITING"]))):
        from credent.chain import spl

        p = s.get(Pool, d.pool_id)
        bal[d.from_wallet] -= spl.to_base(d.amount)
        bal[f"vault:{p.vault_index}"] += spl.to_base(d.amount)
    return {k: v for k, v in bal.items() if v > 0}


def rehydrate(s: Session, chain: ChainService, batch: int = 6) -> int:
    if chain.cluster != "local":
        return 0
    chain.bootstrap()
    legs = [Leg("mint", owner, amount) for owner, amount in expected_balances(s).items()]
    for i in range(0, len(legs), batch):
        chain.execute(legs[i:i + batch])
    for p in s.exec(select(Pool).where(Pool.status != "DRAFT")):
        chain.ensure_account(f"vault:{p.vault_index}")
    return len(legs)
