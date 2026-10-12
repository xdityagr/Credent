import hashlib

from credent.crypto.canonical import canonical_json
from credent.crypto.keys import KeyStore, pubkey_b58, sign_b64, verify_b64
from credent.crypto.merkle import merkle_root


def h(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def test_canonical_json_is_order_independent():
    assert canonical_json({"b": 1, "a": [1, {"d": 2, "c": 3}]}) == '{"a":[1,{"c":3,"d":2}],"b":1}'


def test_merkle_root_shapes():
    a, b, c = h("a"), h("b"), h("c")
    pair = lambda x, y: hashlib.sha256(bytes.fromhex(x) + bytes.fromhex(y)).hexdigest()
    assert merkle_root([]) == "0" * 64
    assert merkle_root([a]) == a
    assert merkle_root([a, b]) == pair(a, b)
    assert merkle_root([a, b, c]) == pair(pair(a, b), pair(c, c))


def test_keystore_persists_and_signs(tmp_path):
    k1 = KeyStore(tmp_path).get("notary")
    k2 = KeyStore(tmp_path).get("notary")
    assert pubkey_b58(k1) == pubkey_b58(k2)
    sig = sign_b64(k1, b"hello")
    assert verify_b64(pubkey_b58(k1), b"hello", sig)
    assert not verify_b64(pubkey_b58(k1), b"hellO", sig)
    assert not verify_b64(pubkey_b58(k1), b"hello", "not-base64!!")
