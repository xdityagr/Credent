# Credent API with the Noir/Barretenberg prover built in (PROVER=local).
# Build from the repo root:  docker build -f apps/api/Dockerfile -t credent-api .
# The repo layout is kept under /app so paths like circuits/ and infra/ resolve as in development.
FROM ubuntu:24.04

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates git bash jq libc++1 \
 && rm -rf /var/lib/apt/lists/*

ENV HOME=/root
SHELL ["/bin/bash", "-c"]

# Same pinned toolchain as infra/prover/Dockerfile.
ARG NOIR_VERSION=1.0.0-beta.22
ARG BB_VERSION=5.0.0-nightly.20260522
RUN curl -sL https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash \
 && /root/.nargo/bin/noirup -v ${NOIR_VERSION}
RUN curl -sL https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/install | bash \
 && /root/.bb/bbup -v ${BB_VERSION}
ENV PATH="/root/.nargo/bin:/root/.bb:${PATH}"

# Compile the circuit and write its verification key once (also warms the CRS cache).
COPY circuits/revenue_proof /app/circuits/revenue_proof
RUN cd /app/circuits/revenue_proof \
 && nargo test && nargo compile && bb write_vk -b target/revenue_proof.json -o target/vk

COPY infra/prover/credent-prove.sh /app/infra/prover/credent-prove.sh
RUN sed -i 's/\r$//' /app/infra/prover/credent-prove.sh && chmod +x /app/infra/prover/credent-prove.sh

# Python deps (uv manages the interpreter too).
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /usr/local/bin/uv
ENV UV_PYTHON_INSTALL_DIR=/opt/python UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app/apps/api
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY apps/api ./
RUN rm -rf keys data .env && uv sync --frozen --no-dev

ENV PROVER=local \
    CIRCUIT_DIR=/app/circuits/revenue_proof \
    COOKIE_SECURE=true \
    PORT=8000
EXPOSE 8000
CMD uv run --no-dev uvicorn credent.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips '*'
