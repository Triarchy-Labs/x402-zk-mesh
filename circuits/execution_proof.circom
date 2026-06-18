pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
 * ExecutionProof — Verifiable Task Completion for X402 ZK Mesh
 *
 * After completing a bounty task, the agent generates a proof that
 * they processed the correct input and produced the correct output.
 *
 * The agent proves:
 *   "I (agentSecret) produced resultHash for taskHash"
 * without revealing their identity or the raw computation.
 *
 * executionId = Poseidon(taskHash, resultHash, agentSecret)
 *
 * Private inputs: agentSecret
 * Public inputs: taskHash, resultHash, executionId
 */
template ExecutionProof() {
    // Public: task descriptor and result hash (verifiable by anyone)
    signal input taskHash;
    signal input resultHash;

    // Private: agent's secret identity
    signal input agentSecret;

    // Public output: unique execution identifier
    signal output executionId;

    // executionId = Poseidon(taskHash, resultHash, agentSecret)
    // Binds the execution to the agent without revealing who they are
    component hasher = Poseidon(3);
    hasher.inputs[0] <== taskHash;
    hasher.inputs[1] <== resultHash;
    hasher.inputs[2] <== agentSecret;
    executionId <== hasher.out;
}

component main = ExecutionProof();
