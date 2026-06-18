pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
 * DepositCommitment — Privacy Pool Module for X402 ZK Mesh
 *
 * A client deposits USDC into the Privacy Pool by generating a commitment:
 *   commitment = Poseidon(secret, nullifier, amount)
 *
 * The commitment is stored on-chain in a Merkle tree.
 * To withdraw, the client reveals the nullifier hash (preventing double-spend)
 * and proves knowledge of the secret + amount without revealing them.
 *
 * Private inputs: secret, nullifier, amount
 * Public outputs: commitment, nullifierHash
 */
template DepositCommitment() {
    // Private inputs (known only to the depositor)
    signal input secret;
    signal input nullifier;
    signal input amount;

    // Public outputs (published on-chain)
    signal output commitment;
    signal output nullifierHash;

    // Commitment = Poseidon(secret, nullifier, amount)
    // This binds the deposit to the secret owner
    component commitmentHasher = Poseidon(3);
    commitmentHasher.inputs[0] <== secret;
    commitmentHasher.inputs[1] <== nullifier;
    commitmentHasher.inputs[2] <== amount;
    commitment <== commitmentHasher.out;

    // NullifierHash = Poseidon(nullifier)
    // Published during withdrawal to prevent double-spending
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHash <== nullifierHasher.out;
}

component main = DepositCommitment();
