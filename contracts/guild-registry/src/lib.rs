#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Bytes, Env, Address, Vec, log};

/// Storage keys for the Guild Registry
#[contracttype]
pub enum DataKey {
    /// The current Merkle root of the agent membership tree
    MerkleRoot,
    /// Admin address (who can update the root)
    Admin,
    /// Total number of registered guild members
    MemberCount,
    /// Historical roots (for proving against older states)
    HistoricalRoot(u32),
    /// Number of historical roots stored
    RootIndex,
}

#[contract]
pub struct GuildRegistryContract;

#[contractimpl]
impl GuildRegistryContract {
    /// Initialize the Guild Registry with an admin and initial Merkle root.
    /// The root is Poseidon(leaf_0, leaf_1, ..., leaf_N) computed off-chain.
    pub fn init(env: Env, admin: Address, initial_root: Bytes, member_count: u32) {
        admin.require_auth();
        
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::MerkleRoot, &initial_root);
        env.storage().persistent().set(&DataKey::MemberCount, &member_count);
        env.storage().persistent().set(&DataKey::RootIndex, &1u32);
        env.storage().persistent().set(&DataKey::HistoricalRoot(0), &initial_root);
        
        log!(&env, "Guild Registry initialized. Members: {}", member_count);
    }

    /// Update the Merkle root when new members join or leave.
    /// Only callable by the admin.
    pub fn update_root(env: Env, admin: Address, new_root: Bytes, new_member_count: u32) {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().persistent()
            .get(&DataKey::Admin)
            .unwrap();
        if admin != stored_admin {
            panic!("Unauthorized: only admin can update root");
        }
        
        // Store old root as historical (for in-flight proofs)
        let idx: u32 = env.storage().persistent()
            .get(&DataKey::RootIndex)
            .unwrap_or(0);
        env.storage().persistent().set(&DataKey::HistoricalRoot(idx), &new_root);
        env.storage().persistent().set(&DataKey::RootIndex, &(idx + 1));
        
        // Update current root
        env.storage().persistent().set(&DataKey::MerkleRoot, &new_root);
        env.storage().persistent().set(&DataKey::MemberCount, &new_member_count);
        
        log!(&env, "Guild root updated. Members: {}. Root index: {}", 
            new_member_count, idx + 1);
    }

    /// Get the current Merkle root.
    /// ZK membership proofs are verified against this root.
    pub fn get_root(env: Env) -> Bytes {
        env.storage().persistent()
            .get(&DataKey::MerkleRoot)
            .unwrap()
    }

    /// Check if a root is valid (current or historical).
    /// Allows agents with in-flight proofs to verify against a recent root.
    pub fn is_valid_root(env: Env, root: Bytes) -> bool {
        // Check current root
        let current: Bytes = env.storage().persistent()
            .get(&DataKey::MerkleRoot)
            .unwrap();
        if current == root {
            return true;
        }
        
        // Check last 10 historical roots
        let idx: u32 = env.storage().persistent()
            .get(&DataKey::RootIndex)
            .unwrap_or(0);
        let start = if idx > 10 { idx - 10 } else { 0 };
        
        for i in start..idx {
            if let Some(hist_root) = env.storage().persistent()
                .get::<_, Bytes>(&DataKey::HistoricalRoot(i)) {
                if hist_root == root {
                    return true;
                }
            }
        }
        
        false
    }

    /// Get the total member count
    pub fn member_count(env: Env) -> u32 {
        env.storage().persistent()
            .get(&DataKey::MemberCount)
            .unwrap_or(0)
    }

    /// Get a specific historical root by index
    pub fn get_historical_root(env: Env, index: u32) -> Bytes {
        env.storage().persistent()
            .get(&DataKey::HistoricalRoot(index))
            .unwrap()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_init_and_update() {
        let env = Env::default();
        let contract_id = env.register(GuildRegistryContract, ());
        let client = GuildRegistryContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        let root = Bytes::from_slice(&env, &[1u8; 32]);
        
        env.mock_all_auths();
        client.init(&admin, &root, &3);
        
        assert_eq!(client.get_root(), root);
        assert_eq!(client.member_count(), 3);
        assert!(client.is_valid_root(&root));
        
        // Update root
        let new_root = Bytes::from_slice(&env, &[2u8; 32]);
        client.update_root(&admin, &new_root, &5);
        
        assert_eq!(client.get_root(), new_root);
        assert_eq!(client.member_count(), 5);
        // Old root still valid (historical)
        assert!(client.is_valid_root(&root));
        assert!(client.is_valid_root(&new_root));
    }
}
