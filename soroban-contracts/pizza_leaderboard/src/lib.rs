#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Symbol};

#[contract]
pub struct PizzaLeaderboard;

// We use a custom key format for our persistent storage.
// We will store the high score as a u32 mapped to each user's Address.
const RECORD: Symbol = symbol_short!("RECORD");

#[contractimpl]
impl PizzaLeaderboard {
    /// Submits a new score for the given player.
    /// Requires the player to sign the transaction.
    /// Only updates the stored score if the new score is strictly greater.
    pub fn submit_score(env: Env, player: Address, score: u32, _duration: u32) {
        // Require that the transaction is signed by the player being recorded
        player.require_auth();

        // Check if the player already has a score
        let current_score: u32 = env
            .storage()
            .persistent()
            .get(&(RECORD, player.clone()))
            .unwrap_or(0);

        // Only update if the new score is a new high score
        if score > current_score {
            env.storage().persistent().set(&(RECORD, player), &score);
        }
    }

    /// Gets the current high score for a specific player.
    pub fn get_score(env: Env, player: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&(RECORD, player))
            .unwrap_or(0)
    }
}

mod test;
