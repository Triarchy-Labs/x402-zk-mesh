#!/bin/bash
set -e

# Test proof generation and verification for the deposit_commitment circuit
# This proves: "I know (secret, nullifier, amount) that hash to the given commitment"

BUILD_DIR="$(dirname "$0")/../build"
KEYS_DIR="$(dirname "$0")/../keys"
CIRCUIT="deposit_commitment"

echo "=== X402 ZK Mesh — Test Proof: $CIRCUIT ==="

# Create witness input (example values)
cat > /tmp/zk_input.json << 'EOF'
{
    "secret": "12345678901234567890",
    "nullifier": "98765432109876543210",
    "amount": "1000000"
}
EOF

echo "[1/4] Generating witness..."
node "$BUILD_DIR/${CIRCUIT}_js/generate_witness.js" \
    "$BUILD_DIR/${CIRCUIT}_js/${CIRCUIT}.wasm" \
    /tmp/zk_input.json \
    /tmp/zk_witness.wtns

echo "[2/4] Generating Groth16 proof..."
npx snarkjs groth16 prove \
    "$KEYS_DIR/${CIRCUIT}_final.zkey" \
    /tmp/zk_witness.wtns \
    /tmp/zk_proof.json \
    /tmp/zk_public.json

echo "[3/4] Public signals:"
cat /tmp/zk_public.json | head -10

echo ""
echo "[4/4] Verifying proof locally..."
npx snarkjs groth16 verify \
    "$KEYS_DIR/${CIRCUIT}_vk.json" \
    /tmp/zk_public.json \
    /tmp/zk_proof.json

echo ""
echo "=== Proof and Public Signals ==="
echo "Proof file: /tmp/zk_proof.json"
echo "Public signals: /tmp/zk_public.json"
echo ""
echo "Proof size: $(wc -c < /tmp/zk_proof.json) bytes"
