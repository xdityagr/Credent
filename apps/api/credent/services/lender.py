from sqlmodel import Session, select

from credent import ledger
from credent.core import pool as poolcore
from credent.errors import InsufficientBalance, InvalidAmount
from credent.models import Balance, Position
from credent.services import clock, pool_store
from credent.terms import FAUCET_AMOUNT


def balance(s: Session, wallet: str) -> int:
    row = s.get(Balance, wallet)
    return row.amount if row else 0


def faucet(s: Session, wallet: str, amount: int = FAUCET_AMOUNT) -> int:
    """Mint demo USDC to a wallet (simulation only; no SPL token moves)."""
    if amount <= 0:
        raise InvalidAmount()
    row = s.get(Balance, wallet) or Balance(wallet=wallet, amount=0)
    row.amount += amount
    s.add(row)
    s.flush()
    return row.amount


def price_e6(t: poolcore.Tranche) -> int:
    """Share price relative to the initial price, scaled by 1e6 (1_000_000 == 1.000000x)."""
    return t.nav * poolcore.SHARE_SCALE * 1_000_000 // t.shares if t.shares else 1_000_000


def deposit(s: Session, wallet: str, tranche: str, amount: int) -> Position:
    if not isinstance(amount, int) or amount <= 0:
        raise InvalidAmount()
    if balance(s, wallet) < amount:
        raise InsufficientBalance()
    pool, minted = poolcore.deposit(pool_store.load(s), tranche, amount)
    bal = s.get(Balance, wallet)
    bal.amount -= amount
    pos = s.get(Position, (wallet, tranche)) or Position(wallet=wallet, tranche=tranche)
    pos.shares += minted
    pos.deposited += amount
    s.add_all([bal, pos])
    pool_store.save(s, pool)
    ledger.append(s, clock.today(s), "Deposit", {
        "wallet": wallet, "tranche": tranche, "amount": amount, "shares": minted,
        "share_price_e6": price_e6(pool.tranche(tranche)),
    })
    return pos


def positions(s: Session, wallet: str) -> dict:
    pool = pool_store.load(s)
    out = []
    for pos in s.exec(select(Position).where(Position.wallet == wallet)):
        t = pool.tranche(pos.tranche)
        value = poolcore.share_value(t, pos.shares)
        out.append({"tranche": pos.tranche, "shares": pos.shares, "deposited": pos.deposited,
                    "value": value, "pnl": value - pos.deposited})
    return {"wallet": wallet, "balance": balance(s, wallet), "positions": out}
