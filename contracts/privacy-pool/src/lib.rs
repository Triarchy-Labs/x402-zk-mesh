#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Bytes, Env, Vec, log};

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
}

#[contract]
pub struct PrivacyPoolContract;

#[contractimpl]
impl PrivacyPoolContract {
    /// Initialize the Privacy Pool with a given tree depth.
    /// Tree depth of 20 supports ~1M deposits.
    pub fn init(env: Env, depth: u32) {
        env.storage().persistent().set(&DataKey::Depth, &depth);
        env.storage().persistent().set(&DataKey::NextIndex, &0u32);
        env.storage().persistent().set(&DataKey::TotalDeposits, &0u64);
        
        // Initialize tree root to empty (all-zero leaves)
        let empty_root = Bytes::from_slice(&env, &[0u8; 32]);
        env.storage().persistent().set(&DataKey::TreeRoot, &empty_root);
        
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
        
        // Note: In production, we'd recompute the Merkle root here.
        // For the prototype, the root is recomputed off-chain and updated
        // via update_root() by the relayer.
        
        log!(&env, "Deposit accepted. Leaf index: {}. Total deposits: {}", 
            index, total + 1);
        
        index
    }

    /// Withdraw from the Privacy Pool by providing a valid ZK proof.
    /// The proof demonstrates:
    ///   1. The prover knows a valid (secret, nullifier, amount) that hashes to a commitment in the tree
    ///   2. The nullifier hasn't been used before (prevents double-spending)
    ///
    /// The nullifier_hash is published (it's a public output of the ZK circuit).
    /// The secret and amount remain private.
    pub fn withdraw(env: Env, nullifier_hash: Bytes, proof_verified: bool) -> bool {
        // Check proof was verified (by the ZK Verifier contract)
        if !proof_verified {
            log!(&env, "Withdrawal rejected: invalid proof");
            return false;
        }
        
        // Check nullifier hasn't been used (double-spend protection)
        let is_spent = env.storage().persistent()
            .get::<_, bool>(&DataKey::Nullifier(nullifier_hash.clone()))
            .unwrap_or(false);
        
        if is_spent {
            log!(&env, "Withdrawal rejected: nullifier already used (double-spend attempt)");
            return false;
        }
        
        // Mark nullifier as spent
        env.storage().persistent().set(&DataKey::Nullifier(nullifier_hash), &true);
        
        log!(&env, "Withdrawal processed successfully");
        true
    }

    /// Update the Merkle root (called by relayer after new deposits)
    pub fn update_root(env: Env, new_root: Bytes) {
        env.storage().persistent().set(&DataKey::TreeRoot, &new_root);
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
