"""Money in and out of pools, as real SPL token movements.

Deposits are signed by the lender's wallet (fee paid by the server) and credited
only after the chain confirms the exact amount reached the pool vault.
Withdrawals update the book and enqueue a vault → lender transfer.
"""

import base64
from datetime import timedelta

from solders.pubkey import Pubkey
from sqlalchemy import update
from sqlmodel import Session, col, select

from credent import ledger
from credent.auth.security import aware, now
from credent.chain import spl
from credent.chain.client import ChainError, explorer_tx
from credent.chain.service import ChainService, Leg
from credent.core import pool as poolcore
from credent.errors import ChainFailure, DomainError, InsufficientBalance, InvalidAmount, NotFound, PoolClosed, RateLimited
from credent.models import ChainTransfer, DepositIntent, Organization, Pool, Position
from credent.services import audit, clock, notify, pools, transfers, wallets


def balance(s: Session, chain: ChainService, org: Organization) -> dict:
    w = wallets.primary(s, org)
    if w is None:
        return {"address": None, "cusd": 0, "sol_lamports": 0}
    return {"address": w.address, "cusd": spl.to_cents(chain.balance(w.address)),
            "sol_lamports": chain.client.sol_balance(Pubkey.from_string(w.address))}


def faucet(s: Session, chain: ChainService, org: Organization, cents: int) -> dict:
    w = wallets.require_primary(s, org)
    recent = s.exec(select(ChainTransfer).where(ChainTransfer.kind == "FAUCET", ChainTransfer.org_id == org.id)
                    .order_by(col(ChainTransfer.id).desc())).first()
    if recent and not org.is_demo and aware(recent.created_at) > now() - timedelta(minutes=2):
        raise RateLimited("The faucet refills every 2 minutes.")
    t = transfers.enqueue(s, "FAUCET", [Leg("mint", w.address, spl.to_base(cents))], org_id=org.id)
    try:
        t.signature = chain.execute([Leg("mint", w.address, spl.to_base(cents))])
        t.status, t.attempts = "SENT", 1
    except ChainError as e:
        raise ChainFailure(f"Faucet transaction failed: {e}") from e
    st = chain.client.status(t.signature)
    if st and st.confirmed:
        t.status, t.confirmed_at = "CONFIRMED", now()
    s.add(t)
    return {"signature": t.signature, "explorer_url": explorer_tx(t.signature, chain.cluster), "amount": cents}


# ---------------------------------------------------------------- deposits

def _position(s: Session, org_id: str, pool_id: str, tranche: str) -> Position:
    return s.get(Position, (org_id, pool_id, tranche)) or Position(org_id=org_id, pool_id=pool_id, tranche=tranche)


def prepare_deposit(s: Session, chain: ChainService, org: Organization, p: Pool, tranche: str, cents: int) -> dict:
    if p.status not in ("FUNDING", "OPEN"):
        raise PoolClosed("This pool isn't accepting deposits.")
    if tranche not in ("senior", "junior"):
        raise InvalidAmount("Choose the senior or junior tranche.")
    if not isinstance(cents, int) or cents < 100_00:
        raise InvalidAmount("Minimum deposit is $100.")
    if tranche == "junior" and org.id != p.manager_org_id and pools.load(p).junior.nav == 0:
        raise PoolClosed("The pool manager funds the first junior capital.")
    poolcore.deposit(pools.load(p), tranche, cents, pools.terms(p))  # dry-run: subordination, impairment
    w = wallets.require_primary(s, org)
    if chain.balance(w.address) < spl.to_base(cents):
        raise InsufficientBalance("Your wallet doesn't hold enough cUSD. Use the faucet on the Funds page.")
    intent = DepositIntent(org_id=org.id, pool_id=p.id, tranche=tranche, amount=cents, from_wallet=w.address,
                           message_hash="", tx_b64="", last_valid_height=0)
    signer = wallets.signer_label(w)
    extra = [chain.keypair(signer)] if signer else []
    tx, h, last_valid = chain.build_user_transfer(Pubkey.from_string(w.address), f"vault:{p.vault_index}",
                                                  spl.to_base(cents), f"credent:deposit:{intent.id}", extra)
    intent.message_hash, intent.tx_b64, intent.last_valid_height = h, base64.b64encode(bytes(tx)).decode(), last_valid
    s.add(intent)
    s.flush()
    return {"intent_id": intent.id, "tx_b64": intent.tx_b64, "needs_signature": not signer,
            "amount": cents, "tranche": tranche}


def submit_deposit(s: Session, chain: ChainService, org: Organization, intent_id: str, signed_b64: str | None) -> DepositIntent:
    intent = s.get(DepositIntent, intent_id)
    if intent is None or intent.org_id != org.id:
        raise NotFound("Deposit not found.")
    if intent.status != "PREPARED":
        return intent
    raw = base64.b64decode(signed_b64 or intent.tx_b64)
    try:
        tx = chain.validate_user_transfer(raw, intent.message_hash)
    except ChainError as e:
        raise ChainFailure(str(e)) from e
    intent.signature, intent.status = str(tx.signatures[0]), "SUBMITTED"
    s.add(intent)
    s.commit()  # signature is recorded before sending, so a lost response can still be confirmed
    try:
        chain.client.send(tx)
    except ChainError as e:  # may still land: leave it SUBMITTED; confirmation checks status/expiry
        intent.error = str(e)[:400]
        s.add(intent)
        s.commit()
    confirm_deposit(s, chain, intent)
    if intent.status == "FAILED":
        raise ChainFailure(f"The deposit transaction failed: {intent.error}")
    return intent


def confirm_deposit(s: Session, chain: ChainService, intent: DepositIntent) -> DepositIntent:
    if intent.status != "SUBMITTED":
        return intent
    st = chain.client.status(intent.signature)
    if st is None:
        if chain.client.block_height() > intent.last_valid_height:
            intent.status, intent.error = "EXPIRED", "The transaction expired before it landed."
            s.add(intent)
            s.commit()
        return intent
    if st.err:
        intent.status, intent.error = "FAILED", st.err
        s.add(intent)
        s.commit()
        return intent
    if not st.confirmed:
        return intent
    p = s.get(Pool, intent.pool_id)
    delta = chain.client.token_delta(intent.signature, chain.token_account(f"vault:{p.vault_index}"))
    if delta != spl.to_base(intent.amount):
        intent.status, intent.error = "FAILED", f"Vault received {delta} base units, expected {spl.to_base(intent.amount)}."
        s.add(intent)
        s.commit()
        return intent
    claimed = s.exec(update(DepositIntent)
                     .where(DepositIntent.id == intent.id, DepositIntent.status == "SUBMITTED")
                     .values(status="CREDITING"))
    if claimed.rowcount != 1:
        return intent  # another worker is crediting it
    s.refresh(intent)
    org = s.get(Organization, intent.org_id)
    try:
        state, minted = poolcore.deposit(pools.load(p), intent.tranche, intent.amount, pools.terms(p))
    except DomainError as e:
        # The tokens arrived but the pool can no longer take them (e.g. leverage changed): send them back.
        intent.status, intent.error = "FAILED", f"{e.message} Your deposit is being refunded."
        transfers.enqueue(s, "DEPOSIT_REFUND", [Leg(f"vault:{p.vault_index}", intent.from_wallet, spl.to_base(intent.amount))],
                          ref_type="deposit", ref_id=intent.id, org_id=org.id, meta={"pool_id": p.id})
        s.add(intent)
        s.commit()
        return intent
    pools.save(s, p, state)
    pos = _position(s, org.id, p.id, intent.tranche)
    pos.shares += minted
    pos.deposited += intent.amount
    s.add(pos)
    intent.status = "CONFIRMED"
    s.add(intent)
    t = state.tranche(intent.tranche)
    ledger.append(s, clock.today(s), "Deposit", {
        "pool_id": p.id, "lender": org.pseudonym, "tranche": intent.tranche, "amount": intent.amount,
        "shares": minted, "share_price_e6": price_e6(t), "signature": intent.signature})
    if org.id != p.manager_org_id:
        notify.notify(s, p.manager_org_id, "deposit", f"New {intent.tranche} deposit in {p.name}",
                      f"{org.name} deposited ${intent.amount / 100:,.2f}.", f"/app/my-pools/{p.id}", email=True)
    audit.log(s, None, org.id, "deposit.confirmed", intent.signature, pool=p.id, amount=intent.amount)
    s.commit()
    return intent


def price_e6(t: poolcore.Tranche) -> int:
    return t.nav * poolcore.SHARE_SCALE * 1_000_000 // t.shares if t.shares else 1_000_000


def confirm_pending(s: Session, chain: ChainService) -> int:
    n = 0
    for intent in s.exec(select(DepositIntent).where(DepositIntent.status == "SUBMITTED")).all():
        confirm_deposit(s, chain, intent)
        n += 1
    return n


# ---------------------------------------------------------------- withdrawals

def withdraw(s: Session, chain: ChainService, org: Organization, p: Pool, tranche: str, cents: int | None) -> dict:
    pos = s.get(Position, (org.id, p.id, tranche))
    if pos is None or pos.shares == 0:
        raise InvalidAmount("You have no position in this tranche.")
    w = wallets.require_primary(s, org)
    state = pools.load(p)
    t = state.tranche(tranche)
    position_value = poolcore.share_value(t, pos.shares)
    if cents is None or cents >= position_value:
        shares = pos.shares
    else:
        if cents <= 0:
            raise InvalidAmount()
        shares = max(1, -(-cents * t.shares // t.nav)) if t.nav else pos.shares
        shares = min(shares, pos.shares)
    state, amount = poolcore.withdraw(state, tranche, shares, pools.terms(p))
    pools.save(s, p, state)
    pos.shares -= shares
    pos.withdrawn += amount
    s.add(pos)
    xfer = transfers.enqueue(s, "WITHDRAWAL", [Leg(f"vault:{p.vault_index}", w.address, spl.to_base(amount))],
                             ref_type="withdrawal", org_id=org.id, meta={"pool_id": p.id})
    ledger.append(s, clock.today(s), "Withdrawal", {"pool_id": p.id, "lender": org.pseudonym, "tranche": tranche,
                                                    "amount": amount, "shares": shares, "transfer_id": xfer.id})
    audit.log(s, None, org.id, "withdrawal", p.slug, amount=amount)
    return {"amount": amount, "shares": shares, "transfer_id": xfer.id}


def portfolio(s: Session, org: Organization) -> list[dict]:
    out = []
    for pos in s.exec(select(Position).where(Position.org_id == org.id)):
        p = s.get(Pool, pos.pool_id)
        t = pools.load(p).tranche(pos.tranche)
        value = poolcore.share_value(t, pos.shares)
        out.append({"pool_id": p.id, "pool_slug": p.slug, "pool_name": p.name, "tranche": pos.tranche,
                    "shares": pos.shares, "deposited": pos.deposited, "withdrawn": pos.withdrawn, "value": value,
                    "pnl": value + pos.withdrawn - pos.deposited, "price_e6": price_e6(t),
                    "coupon_bps": p.senior_coupon_bps if pos.tranche == "senior" else None})
    return out


def deposits(s: Session, org: Organization) -> list[DepositIntent]:
    return list(s.exec(select(DepositIntent).where(DepositIntent.org_id == org.id, DepositIntent.status != "PREPARED")
                       .order_by(col(DepositIntent.created_at).desc()).limit(50)))
