#!/usr/bin/env bash
# credent-prove <commit|prove|verify|vk>
#   vk    : the circuit's canonical verification key -> /work/vk
#   commit: /work/Prover.toml -> /work/commitment (0x-hex circuit output)
#   prove : /work/Prover.toml -> /work/out/{proof,public_inputs,vk}
#   verify: /work/{proof,public_inputs,vk} -> exit 0 if valid
set -euo pipefail
CIRCUIT=${CREDENT_CIRCUIT:-/circuit}
WORK=${CREDENT_WORK:-/work}
mode=${1:-}

now() { date +%s%3N; }

execute() {
  local tmp
  tmp=$(mktemp -d)
  cp -r "$CIRCUIT"/. "$tmp"/
  cp "$WORK/Prover.toml" "$tmp/Prover.toml"
  (cd "$tmp" && nargo execute 2>&1) > "$WORK/execute.log" || { cat "$WORK/execute.log" >&2; exit 3; }
  echo "$tmp"
}

case "$mode" in
  commit)
    tmp=$(execute)
    grep -o 'Circuit output: 0x[0-9a-fA-F]*' "$WORK/execute.log" | awk '{print $3}' > "$WORK/commitment"
    test -s "$WORK/commitment"
    ;;
  prove)
    t0=$(now)
    tmp=$(execute)
    t1=$(now)
    mkdir -p "$WORK/out"
    bb prove -b "$tmp/target/revenue_proof.json" -w "$tmp/target/revenue_proof.gz" \
      -k "$CIRCUIT/target/vk/vk" -o "$WORK/out" > "$WORK/prove.log" 2>&1 || { cat "$WORK/prove.log" >&2; exit 4; }
    t2=$(now)
    cp "$CIRCUIT/target/vk/vk" "$WORK/out/vk"
    bb verify -p "$WORK/out/proof" -i "$WORK/out/public_inputs" -k "$WORK/out/vk" > "$WORK/verify.log" 2>&1 \
      || { cat "$WORK/verify.log" >&2; exit 5; }
    t3=$(now)
    printf '{"witness": %d, "prove": %d, "verify": %d}\n' $((t1 - t0)) $((t2 - t1)) $((t3 - t2)) > "$WORK/out/timings.json"
    ;;
  vk)
    cp "$CIRCUIT/target/vk/vk" "$WORK/vk"
    ;;
  verify)
    bb verify -p "$WORK/proof" -i "$WORK/public_inputs" -k "$WORK/vk" > "$WORK/verify.log" 2>&1 \
      || { cat "$WORK/verify.log" >&2; exit 1; }
    ;;
  *)
    echo "usage: credent-prove <commit|prove|verify|vk>" >&2; exit 2 ;;
esac
