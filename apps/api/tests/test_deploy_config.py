from credent.config import Settings
from credent.crypto.keys import KeyStore, pubkey_b58


def test_render_postgres_urls_get_the_psycopg_driver():
    for raw in ("postgres://u:p@h:5432/db", "postgresql://u:p@h:5432/db"):
        assert Settings(database_url=raw).database_url == "postgresql+psycopg://u:p@h:5432/db"
    assert Settings(database_url="sqlite:///x.db").database_url == "sqlite:///x.db"


def test_keys_derived_from_secret_are_stable_and_distinct(tmp_path):
    a, b = KeyStore(tmp_path / "a", "s3cret"), KeyStore(tmp_path / "b", "s3cret")
    assert pubkey_b58(a.get("notary")) == pubkey_b58(b.get("notary"))  # same secret, any disk
    assert pubkey_b58(a.get("notary")) != pubkey_b58(a.get("custody-master"))
    assert pubkey_b58(KeyStore(tmp_path, "other").get("notary")) != pubkey_b58(a.get("notary"))
    assert not (tmp_path / "a").exists()  # nothing written to disk
