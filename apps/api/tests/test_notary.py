from dataclasses import replace

from credent.crypto.keys import KeyStore
from credent.notary import attest, verify_attestation


def test_attestation_verifies_and_binds_every_field(tmp_path):
    key = KeyStore(tmp_path).get("notary")
    a = attest("stripe-zktls-sim", 0, 89, "acct_123", "0x" + "ab" * 32, key)
    assert verify_attestation(a)
    assert a.account_hash != "acct_123" and "acct_123" not in a.account_hash
    for field, value in [("commitment", "0x" + "cd" * 32), ("period_end", 90),
                         ("source", "receipts"), ("account_hash", "00")]:
        assert not verify_attestation(replace(a, **{field: value}))
