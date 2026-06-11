#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Env};

#[test]
fn test_submit_score() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PizzaLeaderboard);
    let client = PizzaLeaderboardClient::new(&env, &contract_id);

    // Create a mock user
    let user = Address::generate(&env);

    // User submits a score of 100
    // Soroban test environment requires us to mock the auth if we use `.mock_all_auths()`
    // We will use `.mock_all_auths()` to automatically authorize all `require_auth` calls
    env.mock_all_auths();

    // Submit initial score
    client.submit_score(&user, &100, &30);
    assert_eq!(client.get_score(&user), 100);

    // Submit lower score, should not update
    client.submit_score(&user, &50, &15);
    assert_eq!(client.get_score(&user), 100);

    // Submit higher score, should update
    client.submit_score(&user, &250, &60);
    assert_eq!(client.get_score(&user), 250);
}
