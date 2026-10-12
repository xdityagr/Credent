"""Real SPL flows against an in-process Solana VM (LiteSVM)."""

import pytest
from solders.keypair import Keypair

from credent.chain import spl
from credent.chain.client import ChainError, LiteChain
from credent.chain.custody import Custody
from credent.chain.service import ChainService, Leg
from credent.crypto.keys import KeyStore


@pytest.fixture
def chain(tmp_path):
    svc = ChainService(LiteChain(), Custody(KeyStore(tmp_path)), world="w1")
    svc.bootstrap()
    return svc


def test_bootstrap_creates_mint_and_omnibus_accounts(chain):
    assert chain.client.exists(chain.mint)
    assert chain.balance("collections") == 0
    assert chain.balance("treasury") == 0
    assert chain.bootstrap() is None  # idempotent


def test_faucet_mint_to_user(chain):
    user = Keypair()
    chain.execute([Leg("mint", str(user.pubkey()), spl.to_base(500_00))])
    assert chain.balance(str(user.pubkey())) == spl.to_base(500_00)


def test_user_signed_deposit_moves_tokens_and_reports_delta(chain):
    user = Keypair()
    chain.execute([Leg("mint", str(user.pubkey()), spl.to_base(1_000_00))])
    chain.ensure_account("vault:1")
    tx, h, _ = chain.build_user_transfer(user.pubkey(), "vault:1", spl.to_base(400_00), "credent:dep:test")
    tx.partial_sign([user], tx.message.recent_blockhash)  # what the wallet does
    signed = chain.validate_user_transfer(bytes(tx), h)
    sig = chain.client.send(signed)
    assert chain.client.status(sig).confirmed
    assert chain.client.token_delta(sig, chain.token_account("vault:1")) == spl.to_base(400_00)
    assert chain.balance("vault:1") == spl.to_base(400_00)
    assert chain.balance(str(user.pubkey())) == spl.to_base(600_00)


def test_tampered_message_rejected(chain):
    user = Keypair()
    chain.execute([Leg("mint", str(user.pubkey()), spl.to_base(1_000_00))])
    tx, h, _ = chain.build_user_transfer(user.pubkey(), "vault:1", spl.to_base(400_00), "m")
    other, _, _ = chain.build_user_transfer(user.pubkey(), "vault:1", spl.to_base(1), "m")
    other.partial_sign([user], other.message.recent_blockhash)
    with pytest.raises(ChainError, match="altered"):
        chain.validate_user_transfer(bytes(other), h)


def test_unsigned_by_user_rejected(chain):
    user = Keypair()
    tx, h, _ = chain.build_user_transfer(user.pubkey(), "vault:1", 1, "m")
    with pytest.raises(ChainError, match="signatures"):
        chain.validate_user_transfer(bytes(tx), h)


def test_server_transfer_vault_to_borrower_and_settlement(chain):
    borrower = Keypair()
    chain.execute([Leg("mint", "vault:2", spl.to_base(10_000_00)), Leg("mint", "collections", spl.to_base(3_000_00))])
    chain.execute([Leg("vault:2", str(borrower.pubkey()), spl.to_base(4_000_00))])
    chain.execute([Leg("collections", "vault:2", spl.to_base(2_000_00)), Leg("vault:2", "treasury", spl.to_base(50_00))])
    assert chain.balance(str(borrower.pubkey())) == spl.to_base(4_000_00)
    assert chain.balance("vault:2") == spl.to_base(10_000_00 - 4_000_00 + 2_000_00 - 50_00)
    assert chain.balance("collections") == spl.to_base(1_000_00)
    assert chain.balance("treasury") == spl.to_base(50_00)


def test_overdraw_fails_atomically(chain):
    chain.execute([Leg("mint", "vault:3", spl.to_base(100))])
    with pytest.raises(ChainError):
        chain.execute([Leg("vault:3", "treasury", spl.to_base(101))])
    assert chain.balance("vault:3") == spl.to_base(100)


def test_world_scoping_gives_fresh_mint(tmp_path):
    keys = KeyStore(tmp_path)
    a = ChainService(LiteChain(), Custody(keys), "w1")
    b = ChainService(LiteChain(), Custody(keys), "w2")
    assert a.mint != b.mint
    assert a.fee_payer.pubkey() == b.fee_payer.pubkey()
