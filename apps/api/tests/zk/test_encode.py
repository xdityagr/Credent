import pytest

from credent.zk.encode import normalize_field_hex, parse_public_inputs, prover_toml


def test_prover_toml_format():
    toml = prover_toml([1, 2] + [3] * 88, "77", 5)
    lines = toml.strip().splitlines()
    assert lines[0].startswith('daily = ["1", "2", "3"')
    assert lines[0].count('"') == 180
    assert lines[1] == 'salt = "77"'
    assert lines[2] == 'threshold = "5"'


def test_prover_toml_requires_90_days():
    with pytest.raises(ValueError):
        prover_toml([1] * 89, "1", 0)


def test_parse_public_inputs():
    buf = (1_234_567).to_bytes(32, "big") + bytes.fromhex("0a" * 32)
    assert parse_public_inputs(buf) == (1_234_567, "0x" + "0a" * 32)


def test_parse_public_inputs_wrong_length():
    with pytest.raises(ValueError):
        parse_public_inputs(b"\x00" * 63)


def test_normalize_field_hex_pads():
    assert normalize_field_hex("0x1") == "0x" + "0" * 63 + "1"
    assert normalize_field_hex("0xABC") == normalize_field_hex("0x0abc")
