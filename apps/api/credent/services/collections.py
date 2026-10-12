"""Lockbox collections.

Every customer payment for a connected business lands in Credent's omnibus
collections account. The sweep takes what the active loan's installment still
needs; the remainder is the business's operating balance, withdrawable to its
wallet. On-chain, inflows are minted once per day *in aggregate across all
borrowers*, so no single business's revenue appears on Solana.
"""

from sqlmodel import Session, func, select

from credent.chain import spl
from credent.chain.service import Leg
from credent.core.sweep import apply_payment
from credent.errors import InvalidAmount
from credent.models import ChainTransfer, OperatingBalance, Organization, PrivatePayment
from credent.services import audit, clock, loans, transfers, wallets


def ingest(s: Session, org_id: str, amount: int, external_ref: str, source_id: str | None = None,
           day: int | None = None) -> PrivatePayment:
    existing = s.exec(select(PrivatePayment).where(PrivatePayment.external_ref == external_ref)).first()
    if existing:
        return existing  # idempotent: Stripe polls and sim replays can deliver twice
    if not isinstance(amount, int) or amount <= 0:
        raise InvalidAmount()
    day = clock.today(s) if day is None else day
    loan = loans.active_for(s, org_id)
    swept, released = 0, amount
    if loan:
        st, swept, released = apply_payment(loans.state(loan), amount)
        loans.save_state(s, loan, st)
    pay = PrivatePayment(org_id=org_id, source_id=source_id, loan_id=loan.id if loan else None,
                         external_ref=external_ref, day=day, amount=amount, swept=swept, released=released)
    s.add(pay)
    bal = s.get(OperatingBalance, org_id) or OperatingBalance(org_id=org_id, amount=0)
    bal.amount += released
    s.add(bal)
    return pay


def mint_inflows(s: Session, day: int) -> ChainTransfer | None:
    """Mirror one day's total inflows (all borrowers combined) into the collections account."""
    ref = f"inflows:{day}"
    if s.exec(select(ChainTransfer).where(ChainTransfer.kind == "INFLOW_MINT", ChainTransfer.ref_id == ref)).first():
        return None
    total = int(s.exec(select(func.coalesce(func.sum(PrivatePayment.amount), 0)).where(PrivatePayment.day == day)).one())
    if not total:
        return None
    return transfers.enqueue(s, "INFLOW_MINT", [Leg("mint", "collections", spl.to_base(total))],
                             ref_type="inflows", ref_id=ref)


def operating(s: Session, org: Organization) -> dict:
    bal = s.get(OperatingBalance, org.id)
    total = bal.amount if bal else 0
    today = clock.today(s)
    pending = int(s.exec(select(func.coalesce(func.sum(PrivatePayment.released), 0))
                         .where(PrivatePayment.org_id == org.id, PrivatePayment.day >= today)).one())
    return {"balance": total, "available": max(0, total - pending), "settling": min(total, pending)}


def withdraw_operating(s: Session, org: Organization, cents: int | None) -> dict:
    info = operating(s, org)
    amount = info["available"] if cents is None else cents
    if amount <= 0:
        raise InvalidAmount("Nothing is available to withdraw yet. Today's inflows settle overnight.")
    if amount > info["available"]:
        raise InvalidAmount(f"Only ${info['available'] / 100:,.2f} is available right now.")
    w = wallets.require_primary(s, org)
    bal = s.get(OperatingBalance, org.id)
    bal.amount -= amount
    s.add(bal)
    xfer = transfers.enqueue(s, "OPERATING_PAYOUT", [Leg("collections", w.address, spl.to_base(amount))],
                             ref_type="operating", org_id=org.id)
    audit.log(s, None, org.id, "operating.withdraw", amount=amount)
    return {"amount": amount, "transfer_id": xfer.id}


def payments(s: Session, org: Organization, limit: int = 100) -> list[PrivatePayment]:
    return list(s.exec(select(PrivatePayment).where(PrivatePayment.org_id == org.id)
                       .order_by(PrivatePayment.id.desc()).limit(limit)))
