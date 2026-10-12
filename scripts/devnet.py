"""Devnet helper: show the fee-payer address, request an airdrop, and run a token round-trip smoke test.

    cd apps/api && uv run python ../../scripts/devnet.py status
    cd apps/api && uv run python ../../scripts/devnet.py airdrop
    cd apps/api && uv run python ../../scripts/devnet.py smoke

If the airdrop is rate-limited, fund the fee payer at https://faucet.solana.com (devnet, 1-2 SOL),
then set CHAIN_MODE=devnet in .env and restart the API.
"""

import secrets
import sys

from solders.keypair import Keypair

from credent.chain import spl
from credent.chain.client import RpcChain, explorer_tx
from credent.chain.custody import Custody
from credent.chain.service import ChainService, Leg
from credent.config import Settings
from credent.crypto.keys import KeyStore


def main(cmd: str) -> None:
    settings = Settings()
    chain = ChainService(RpcChain(settings.solana_rpc_url), Custody(KeyStore(settings.keys_dir)),
                         world=f"smoke-{secrets.token_hex(3)}")
    fp = chain.fee_payer.pubkey()
    sol = chain.client.sol_balance(fp) / 1e9
    print(f"fee payer: {fp}  balance: {sol:.4f} SOL  rpc: {settings.solana_rpc_url}")
    if cmd == "airdrop":
        try:
            chain.client.airdrop(fp, 1_000_000_000)
            print("airdrop requested; check the balance again in ~20s")
        except Exception as e:  # noqa: BLE001
            print(f"airdrop refused ({e}). Fund {fp} at https://faucet.solana.com (devnet).")
    elif cmd == "smoke":
        if sol < 0.05:
            sys.exit("fee payer needs at least 0.05 SOL; run `airdrop` or use the web faucet")
        print("bootstrap mint:", explorer_tx(chain.bootstrap() or "", "devnet"))
        user = Keypair()
        print("faucet:", explorer_tx(chain.execute([Leg("mint", str(user.pubkey()), spl.to_base(1_000_00))]), "devnet"))
        tx, h, _ = chain.build_user_transfer(user.pubkey(), "vault:1", spl.to_base(400_00), "credent:smoke")
        tx.partial_sign([user], tx.message.recent_blockhash)
        print("user-signed deposit:", explorer_tx(chain.client.send(chain.validate_user_transfer(bytes(tx), h)), "devnet"))
        print("vault → treasury:", explorer_tx(chain.execute([Leg("vault:1", "treasury", spl.to_base(10_00))]), "devnet"))
        print("vault balance (cents):", spl.to_cents(chain.balance("vault:1")))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "status")
