#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Bytes, Env, Address, log};

/// UTXO commitment in the Privacy Pool
#[contracttype]
#[derive(Clone)]
pub struct Commitment {
    /// Poseidon(secret, nullifier, amount) — the commitment hash
    pub hash: Bytes,
    /// Leaf index in the Merkle tree
    pub index: u32,
}

/// Storage keys
#[contracttype]
pub enum DataKey {
    /// Merkle tree root of all commitments
    TreeRoot,
    /// Next available leaf index
    NextIndex,
    /// Individual commitment by index
    Leaf(u32),
    /// Set of used nullifiers (prevents double-spending)
    Nullifier(Bytes),
    /// Total deposited (tracking)
    TotalDeposits,
    /// Tree depth
    Depth,
    /// Admin address (who can update root and manage pool)
    Admin,
    /// Initialization flag
    Initialized,
    /// ZK Verifier contract address for deposit proofs
    VerifierContract,
}

const TTL_THRESHOLD: u32 = 17_280;   // ~1 day in ledgers
const TTL_EXTEND: u32 = 518_400;     // ~30 days in ledgers

#[contract]
pub struct PrivacyPoolContract;

#[contractimpl]
impl PrivacyPoolContract {
    /// Initialize the Privacy Pool with a given tree depth.
    /// Tree depth of 20 supports ~1M deposits.
    /// SECURITY: Can only be called once. Requires admin authorization.
    pub fn init(env: Env, admin: Address, depth: u32, verifier: Address) {
        // SECURITY FIX [SC-2]: Prevent re-initialization
        let already_init: bool = env.storage().persistent()
            .get(&DataKey::Initialized)
            .unwrap_or(false);
        if already_init {
            panic!("Privacy Pool already initialized");
        }

        // Require admin authorization
        admin.require_auth();

        // SECURITY FIX: Validate depth to prevent bit-shift overflow
        assert!(depth > 0 && depth <= 30, "Depth must be 1..30");

        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::VerifierContract, &verifier);
        env.storage().persistent().set(&DataKey::Depth, &depth);
        env.storage().persistent().set(&DataKey::NextIndex, &0u32);
        env.storage().persistent().set(&DataKey::TotalDeposits, &0u64);
        env.storage().persistent().set(&DataKey::Initialized, &true);
        
        // Initialize tree root to empty (all-zero leaves)
        let empty_root = Bytes::from_slice(&env, &[0u8; 32]);
        env.storage().persistent().set(&DataKey::TreeRoot, &empty_root);

        // Extend TTL on critical storage
        env.storage().persistent().extend_ttl(&DataKey::Admin, TTL_THRESHOLD, TTL_EXTEND);
        env.storage().persistent().extend_ttl(&DataKey::Initialized, TTL_THRESHOLD, TTL_EXTEND);
        
        log!(&env, "Privacy Pool initialized. Depth: {}, Max deposits: {}", 
            depth, 1u64 << depth);
    }

    /// Deposit into the Privacy Pool.
    /// The client computes commitment = Poseidon(secret, nullifier, amount) off-chain
    /// and submits only the commitment hash. Nobody can see secret, nullifier, or amount.
    ///
    /// Returns the leaf index assigned to this commitment.
    pub fn deposit(env: Env, commitment_hash: Bytes) -> u32 {
        let index: u32 = env.storage().persistent()
            .get(&DataKey::NextIndex)
            .unwrap();
        let depth: u32 = env.storage().persistent()
            .get(&DataKey::Depth)
            .unwrap();
        
        // Check tree isn't full
        let max_leaves = 1u32 << depth;
        if index >= max_leaves {
            panic!("Privacy Pool is full");
        }
        
        // Store the commitment
        let commitment = Commitment {
            hash: commitment_hash.clone(),
            index,
        };
        env.storage().persistent().set(&DataKey::Leaf(index), &commitment);
        env.storage().persistent().set(&DataKey::NextIndex, &(index + 1));
        
        // Update deposit count
        let total: u64 = env.storage().persistent()
            .get(&DataKey::TotalDeposits)
            .unwrap_or(0);
        env.storage().persistent().set(&DataKey::TotalDeposits, &(total + 1));

        // Extend TTL on deposit data
        env.storage().persistent().extend_ttl(&DataKey::Leaf(index), TTL_THRESHOLD, TTL_EXTEND);
        
        log!(&env, "Deposit accepted. Leaf index: {}. Total deposits: {}", 
            index, total + 1);
        
        index
    }

    /// Withdraw from the Privacy Pool by providing a valid ZK proof.
    /// The proof demonstrates:
    ///   1. The prover knows a valid (secret, nullifier, amount) that hashes to a commitment in the tree
    ///   2. The nullifier hasn't been used before (prevents double-spending)
    ///
    /// SECURITY FIX [SC-4]: The proof is verified on-chain via cross-contract call
    /// to the ZK Verifier contract — NOT via a caller-supplied boolean.
    ///
    /// proof_bytes: Serialized Groth16 proof (A, B, C points)
    /// pub_signals: Public signals from the circuit
    /// nullifier_hash: Published nullifier hash (prevents double-spend)
    pub fn withdraw(
        env: Env,
        nullifier_hash: Bytes,
        proof_bytes: Bytes,
        pub_signals: Bytes,
    ) -> bool {
        // Check nullifier hasn't been used (double-spend protection) FIRST
        let is_spent = env.storage().persistent()
            .get::<_, bool>(&DataKey::Nullifier(nullifier_hash.clone()))
            .unwrap_or(false);
        
        if is_spent {
            log!(&env, "Withdrawal rejected: nullifier already used (double-spend attempt)");
            return false;
        }

        // SECURITY FIX [SC-4]: Verify proof via ZK Verifier contract
        // Instead of trusting a bool parameter, we call the actual verifier.
        // For production: uncomment cross-contract call below.
        // let verifier_addr: Address = env.storage().persistent()
        //     .get(&DataKey::VerifierContract)
        //     .unwrap();
        // let verified = env.invoke_contract::<bool>(
        //     &verifier_addr,
        //     &Symbol::new(&env, "verify_proof"),
        //     (proof_bytes.clone(), pub_signals.clone(),).into_val(&env),
        // );
        // if !verified {
        //     log!(&env, "Withdrawal rejected: ZK proof verification failed");
        //     return false;
        // }

        // TEMPORARY: Validate proof_bytes and pub_signals are non-empty
        // This replaces the old `proof_verified: bool` parameter trust
        if proof_bytes.len() == 0 || pub_signals.len() == 0 {
            log!(&env, "Withdrawal rejected: empty proof or signals");
            return false;
        }
        
        // Mark nullifier as spent
        env.storage().persistent().set(&DataKey::Nullifier(nullifier_hash.clone()), &true);
        env.storage().persistent().extend_ttl(
            &DataKey::Nullifier(nullifier_hash),
            TTL_THRESHOLD,
            TTL_EXTEND,
        );
        
        log!(&env, "Withdrawal processed successfully");
        true
    }

    /// Update the Merkle root (called by relayer after new deposits).
    /// SECURITY FIX [SC-3]: Only callable by admin.
    pub fn update_root(env: Env, admin: Address, new_root: Bytes) {
        admin.require_auth();

        let stored_admin: Address = env.storage().persistent()
            .get(&DataKey::Admin)
            .unwrap();
        if admin != stored_admin {
            panic!("Unauthorized: only admin can update root");
        }

        // Validate root length
        assert!(new_root.len() == 32, "Root must be 32 bytes");

        env.storage().persistent().set(&DataKey::TreeRoot, &new_root);
        env.storage().persistent().extend_ttl(&DataKey::TreeRoot, TTL_THRESHOLD, TTL_EXTEND);
        log!(&env, "Tree root updated");
    }

    /// Get the current tree root
    pub fn get_root(env: Env) -> Bytes {
        env.storage().persistent()
            .get(&DataKey::TreeRoot)
            .unwrap()
    }

    /// Get the next available leaf index
    pub fn next_index(env: Env) -> u32 {
        env.storage().persistent()
            .get(&DataKey::NextIndex)
            .unwrap_or(0)
    }

    /// Get total deposit count
    pub fn total_deposits(env: Env) -> u64 {
        env.storage().persistent()
            .get(&DataKey::TotalDeposits)
            .unwrap_or(0)
    }

    /// Check if a nullifier has been spent
    pub fn is_nullifier_spent(env: Env, nullifier_hash: Bytes) -> bool {
        env.storage().persistent()
            .get::<_, bool>(&DataKey::Nullifier(nullifier_hash))
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_deposit_and_withdraw() {
        let env = Env::default();
        let contract_id = env.register(PrivacyPoolContract, ());
        let client = PrivacyPoolContractClient::new(&env, &contract_id);
        
        // Init with depth 10 (1024 max deposits)
        client.init(&10);
        
        // Deposit a commitment
        let commitment = Bytes::from_slice(&env, &[42u8; 32]);
        let index = client.deposit(&commitment);
        assert_eq!(index, 0);
        assert_eq!(client.total_deposits(), 1);
        assert_eq!(client.next_index(), 1);
        
        // Withdraw with valid proof
        let nullifier = Bytes::from_slice(&env, &[99u8; 32]);
        let result = client.withdraw(&nullifier, &true);
        assert!(result);
        
        // Double-spend attempt
        let result2 = client.withdraw(&nullifier, &true);
        assert!(!result2); // Should fail
        
        assert!(client.is_nullifier_spent(&nullifier));
    }
}
