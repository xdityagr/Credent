# Credent prover image: pinned Noir + Barretenberg with the revenue_proof
# circuit precompiled and its verification key baked in.
# Build from the repo root:  docker build -f infra/prover/Dockerfile -t credent-prover .
FROM ubuntu:24.04

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates git bash jq libc++1 \
 && rm -rf /var/lib/apt/lists/*

ENV HOME=/root
SHELL ["/bin/bash", "-c"]

ARG NOIR_VERSION=1.0.0-beta.22
ARG BB_VERSION=5.0.0-nightly.20260522

RUN curl -sL https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash \
 && /root/.nargo/bin/noirup -v ${NOIR_VERSION}
RUN curl -sL https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/install | bash \
 && /root/.bb/bbup -v ${BB_VERSION}
ENV PATH="/root/.nargo/bin:/root/.bb:${PATH}"

COPY circuits/revenue_proof /circuit
WORKDIR /circuit
# Test, compile, and write the VK once (this also warms the CRS cache).
RUN nargo test \
 && nargo compile \
 && bb write_vk -b target/revenue_proof.json -o target/vk

COPY infra/prover/credent-prove.sh /usr/local/bin/credent-prove
RUN sed -i 's/\r$//' /usr/local/bin/credent-prove && chmod +x /usr/local/bin/credent-prove

WORKDIR /work
ENTRYPOINT ["credent-prove"]
