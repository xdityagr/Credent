"""SPL Token / ATA / Memo instruction builders (byte-packed; solders has no SPL builders)."""

from solders.instruction import AccountMeta, Instruction
from solders.pubkey import Pubkey
from solders.system_program import ID as SYSTEM_PROGRAM
from solders.system_program import CreateAccountParams, create_account
from solders.token.associated import get_associated_token_address

TOKEN_PROGRAM = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
ATA_PROGRAM = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
MEMO_PROGRAM = Pubkey.from_string("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")
MINT_SIZE = 82
DECIMALS = 6
CENTS_TO_BASE = 10 ** (DECIMALS - 2)  # 1 cent = 10_000 base units of a 6-dp token


def to_base(cents: int) -> int:
    return cents * CENTS_TO_BASE


def to_cents(base: int) -> int:
    return base // CENTS_TO_BASE


def ata(owner: Pubkey, mint: Pubkey) -> Pubkey:
    return get_associated_token_address(owner, mint)


def create_mint_account(payer: Pubkey, mint: Pubkey, lamports: int) -> Instruction:
    return create_account(CreateAccountParams(from_pubkey=payer, to_pubkey=mint, lamports=lamports,
                                              space=MINT_SIZE, owner=TOKEN_PROGRAM))


def initialize_mint2(mint: Pubkey, authority: Pubkey, decimals: int = DECIMALS) -> Instruction:
    data = bytes([20, decimals]) + bytes(authority) + bytes([0])  # no freeze authority
    return Instruction(TOKEN_PROGRAM, data, [AccountMeta(mint, False, True)])


def create_ata_idempotent(payer: Pubkey, owner: Pubkey, mint: Pubkey) -> Instruction:
    return Instruction(ATA_PROGRAM, bytes([1]), [
        AccountMeta(payer, True, True),
        AccountMeta(ata(owner, mint), False, True),
        AccountMeta(owner, False, False),
        AccountMeta(mint, False, False),
        AccountMeta(SYSTEM_PROGRAM, False, False),
        AccountMeta(TOKEN_PROGRAM, False, False),
    ])


def transfer_checked(src: Pubkey, mint: Pubkey, dst: Pubkey, owner: Pubkey, amount: int,
                     decimals: int = DECIMALS) -> Instruction:
    data = bytes([12]) + amount.to_bytes(8, "little") + bytes([decimals])
    return Instruction(TOKEN_PROGRAM, data, [
        AccountMeta(src, False, True),
        AccountMeta(mint, False, False),
        AccountMeta(dst, False, True),
        AccountMeta(owner, True, False),
    ])


def mint_to_checked(mint: Pubkey, dst: Pubkey, authority: Pubkey, amount: int,
                    decimals: int = DECIMALS) -> Instruction:
    data = bytes([14]) + amount.to_bytes(8, "little") + bytes([decimals])
    return Instruction(TOKEN_PROGRAM, data, [
        AccountMeta(mint, False, True),
        AccountMeta(dst, False, True),
        AccountMeta(authority, True, False),
    ])


def memo(text: str, signers: list[Pubkey] = ()) -> Instruction:
    return Instruction(MEMO_PROGRAM, text.encode(), [AccountMeta(s, True, False) for s in signers])


def token_amount(account_data: bytes) -> int:
    """Amount field of an SPL token account (offset 64, u64 LE)."""
    return int.from_bytes(bytes(account_data)[64:72], "little")
