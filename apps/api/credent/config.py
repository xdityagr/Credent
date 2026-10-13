from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = API_ROOT.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(REPO_ROOT / ".env", API_ROOT / ".env"), extra="ignore")

    # storage
    data_dir: Path = API_ROOT / "data"  # uploads, sqlite fallback
    keys_dir: Path = API_ROOT / "keys"  # long-lived secrets (custody master, notary); survives world resets
    key_secret: str = ""  # if set, all keys derive from it instead of keys_dir (hosts with ephemeral disks)
    database_url: str = "postgresql+psycopg://credent:credent@localhost:5434/credent"

    # web
    app_url: str = "http://localhost:3000"  # used in email links
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    cookie_secure: bool = False
    session_days: int = 14

    # email (Mailpit by default)
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_tls: bool = False
    mail_from: str = "Credent <no-reply@credent.local>"

    # zk prover
    prover: Literal["docker", "local"] = "docker"
    prover_image: str = "credent-prover"
    circuit_dir: Path = REPO_ROOT / "circuits" / "revenue_proof"

    # solana
    chain_mode: Literal["local", "devnet"] = "local"
    solana_rpc_url: str = "https://api.devnet.solana.com"
    anchor_enabled: bool = True
    faucet_amount: int = 250_000_00  # cents of cUSD per faucet request

    # demo world
    sim_enabled: bool = True
    clock_mode: Literal["accelerated", "manual"] = "accelerated"
    seconds_per_day: float = 120.0
    seed_demo: bool = True
    background_jobs: bool = True

    @field_validator("database_url")
    @classmethod
    def _psycopg_scheme(cls, v: str) -> str:
        """Hosts hand out postgres:// URLs; SQLAlchemy needs the psycopg (v3) driver named."""
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v

    def db_url(self) -> str:
        if self.database_url.startswith("sqlite") and "///" in self.database_url:
            self.data_dir.mkdir(parents=True, exist_ok=True)
        return self.database_url
