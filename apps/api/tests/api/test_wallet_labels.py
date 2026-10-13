import base58
from solders.keypair import Keypair

from tests.api.test_flows import register


def _link(client, provider=None) -> str:
    kp = Keypair()
    addr = str(kp.pubkey())
    msg = client.post("/wallets/challenge", json={"address": addr}).json()["message"]
    sig = base58.b58encode(bytes(kp.sign_message(msg.encode()))).decode()
    body = {"address": addr, "signature": sig} | ({"provider": provider} if provider else {})
    assert client.post("/wallets/verify", json=body).status_code == 200
    return addr


def test_wallet_remembers_which_app_linked_it(client, db):
    register(client, db, "w@x.io", "BORROWER", "Wallet Co")
    phantom = _link(client, "Phantom")
    older = _link(client)
    wallets = {w["address"]: w for w in client.get("/me").json()["wallets"]}
    assert wallets[phantom]["provider"] == "Phantom" and wallets[older]["provider"] is None

    # a wallet linked before names were saved is labelled when it next connects
    r = client.patch(f"/wallets/{older}", json={"provider": "Solflare"})
    assert r.status_code == 200 and r.json()["provider"] == "Solflare" and not r.json()["is_primary"]
    # making primary still works through the same route
    assert client.patch(f"/wallets/{older}", json={"is_primary": True}).json()["is_primary"]


def test_cannot_label_another_orgs_wallet(client, db):
    register(client, db, "a@x.io", "BORROWER", "A Co")
    addr = _link(client, "Phantom")
    client.post("/auth/logout")
    register(client, db, "b@x.io", "BORROWER", "B Co")
    assert client.patch(f"/wallets/{addr}", json={"provider": "Evil"}).status_code == 404
