pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
 * MembershipProof — Guild Identity Module for X402 ZK Mesh
 *
 * An agent proves they belong to the approved Guild roster using a
 * Merkle inclusion proof. The Merkle root is stored on-chain in the
 * Guild Registry contract.
 *
 * The agent proves: "I am one of the N approved agents" without
 * revealing which one.
 *
 * Private inputs: leaf (agent identity hash), pathElements, pathIndices
 * Public inputs: root (on-chain Merkle root)
 */
template MembershipProof(levels) {
    // Private: the agent's identity and Merkle path
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Public: the known Merkle root from on-chain Guild Registry
    signal output root;

    // Traverse the Merkle tree from leaf to root
    component hashers[levels];
    signal hashes[levels + 1];
    signal s[levels];
    hashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);

        // Constrain pathIndices to be 0 or 1
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        // Select left and right based on index
        s[i] <== pathIndices[i] * (pathElements[i] - hashes[i]);

        hashers[i].inputs[0] <== hashes[i] + s[i];
        hashers[i].inputs[1] <== pathElements[i] - s[i];

        hashes[i + 1] <== hashers[i].out;
    }

    root <== hashes[levels];
}

// 10 levels = supports up to 1024 guild members
component main = MembershipProof(10);
