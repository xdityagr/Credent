from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = API_ROOT.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(REPO_ROOT / ".env", API_ROOT / ".env"), extra="ignore")

    data_dir: Path = API_ROOT / "data"
    database_url: str = ""  # defaults to sqlite in data_dir

    prover: Literal["docker", "local"] = "docker"
    prover_image: str = "credent-prover"
    circuit_dir: Path = REPO_ROOT / "circuits" / "revenue_proof"

    anchor_enabled: bool = True
    solana_rpc_url: str = "https://api.devnet.solana.com"

    sim_enabled: bool = True
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    def db_url(self) -> str:
        if self.database_url:
            return self.database_url
        self.data_dir.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{(self.data_dir / 'credent.db').as_posix()}"
