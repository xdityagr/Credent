import json

import httpx
import pytest
from sqlmodel import Session

from credent import ledger
from credent.anchor import SolanaAnchor, anchor_pending, memo_text
from credent.config import Settings
from credent.crypto.keys import KeyStore
from credent.models import Block


def rpc_handler(fail: bool = False):
    calls = []

    def handle(req: httpx.Request) -> httpx.Response:
        body = json.loads(req.content)
        calls.append(body["method"])
        if fail:
            return httpx.Response(503, text="rate limited")
        result = {
            "getLatestBlockhash": {"context": {"slot": 1}, "value": {"blockhash": "11111111111111111111111111111111", "lastValidBlockHeight": 9}},
            "sendTransaction": "5sig",
            "getBalance": {"context": {"slot": 1}, "value": 10**9},
        }[body["method"]]
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": body["id"], "result": result})

    return handle, calls


def make(tmp_path, enabled=True, fail=False):
    handle, calls = rpc_handler(fail)
    settings = Settings(data_dir=tmp_path, anchor_enabled=enabled)
    a = SolanaAnchor(settings, KeyStore(tmp_path), http=httpx.Client(transport=httpx.MockTransport(handle)))
    return a, calls


def block() -> Block:
    return Block(n=7, first_seq=1, last_seq=3, merkle_root="ab" * 32, day=98)


def test_memo_text():
    assert memo_text(block()) == "credent:v1:block:7:" + "ab" * 32


def test_disabled(tmp_path):
    a, calls = make(tmp_path, enabled=False)
    assert a.anchor(block()) == ("DISABLED", None, None)
    assert calls == []


def test_success(tmp_path):
    a, calls = make(tmp_path)
    status, sig, err = a.anchor(block())
    assert (status, sig, err) == ("ANCHORED", "5sig", None)
    assert calls == ["getLatestBlockhash", "sendTransaction"]


def test_rpc_failure_is_unanchored(tmp_path):
    a, _ = make(tmp_path, fail=True)
    status, sig, err = a.anchor(block())
    assert status == "UNANCHORED" and sig is None and err


def test_anchor_pending_updates_rows(tmp_path, engine):
    a, _ = make(tmp_path)
    with Session(engine) as s:
        ledger.append(s, 90, "X", {})
        ledger.seal_block(s, 91)
        s.commit()
        assert anchor_pending(s, a) == 1
        b = s.get(Block, 1)
        assert (b.anchor_status, b.anchor_sig) == ("ANCHORED", "5sig")
        assert anchor_pending(s, a) == 0


def test_explorer_url(tmp_path):
    a, _ = make(tmp_path)
    assert a.explorer_tx("5sig").endswith("/tx/5sig?cluster=devnet")
    assert len(a.address) >= 32
