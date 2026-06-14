#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScoreRecord {
    pub player: Address,
    pub name: String,
    pub score: u32,
    pub timestamp: u64,
}

const LEADERBOARD_KEY: soroban_sdk::Symbol = symbol_short!("SCORES");
const MAX_SCORES: u32 = 20;

#[contract]
pub struct LeaderboardContract;

#[contractimpl]
impl LeaderboardContract {
    pub fn submit_score(env: Env, player: Address, name: String, score: u32) {
        // Asegurarse de que el jugador ha firmado la transacción
        player.require_auth();
        
        let mut scores: Vec<ScoreRecord> = env.storage().persistent().get(&LEADERBOARD_KEY).unwrap_or(Vec::new(&env));
        
        let new_record = ScoreRecord {
            player: player.clone(),
            name,
            score,
            timestamp: env.ledger().timestamp(),
        };

        if scores.len() < MAX_SCORES {
            scores.push_back(new_record);
        } else {
            // Encontrar la puntuación más baja actual
            let mut lowest_idx = 0;
            let mut lowest_score = u32::MAX;
            
            for i in 0..scores.len() {
                if let Some(record) = scores.get(i) {
                    if record.score < lowest_score {
                        lowest_score = record.score;
                        lowest_idx = i;
                    }
                }
            }
            
            // Reemplazar si la nueva puntuación es mayor
            if score > lowest_score {
                scores.set(lowest_idx, new_record);
            }
        }
        
        // Guardar la tabla actualizada
        env.storage().persistent().set(&LEADERBOARD_KEY, &scores);
    }

    pub fn get_scores(env: Env) -> Vec<ScoreRecord> {
        env.storage().persistent().get(&LEADERBOARD_KEY).unwrap_or(Vec::new(&env))
    }
}
