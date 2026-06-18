#!/bin/bash
set -e

KEYS_DIR="$(dirname "$0")/../keys"
BUILD_DIR="$(dirname "$0")/../build"
PTAU="$KEYS_DIR/pot14_final.ptau"

echo "=== X402 ZK Mesh — Circuit-Specific Trusted Setup ==="

for circuit in deposit_commitment membership_proof execution_proof; do
    echo ""
    echo "--- Setting up: $circuit ---"
    
    # Phase 2: Circuit-specific setup
    npx snarkjs groth16 setup \
        "$BUILD_DIR/${circuit}.r1cs" \
        "$PTAU" \
        "$KEYS_DIR/${circuit}_0000.zkey" 2>&1 | tail -2
    
    # Contribute to Phase 2
    npx snarkjs zkey contribute \
        "$KEYS_DIR/${circuit}_0000.zkey" \
        "$KEYS_DIR/${circuit}_final.zkey" \
        --name="X402 Guild Contribution" \
        -e="entropy_${circuit}_$(date +%s)" 2>&1 | tail -2
    
    # Export verification key
    npx snarkjs zkey export verificationkey \
        "$KEYS_DIR/${circuit}_final.zkey" \
        "$KEYS_DIR/${circuit}_vk.json" 2>&1 | tail -1
    
    echo "✅ $circuit — verification key exported"
    
    # Clean up intermediate zkey
    rm -f "$KEYS_DIR/${circuit}_0000.zkey"
done

echo ""
echo "=== All circuits setup complete ==="
ls -la "$KEYS_DIR"/*.json 2>/dev/null || echo "No VK files found"
