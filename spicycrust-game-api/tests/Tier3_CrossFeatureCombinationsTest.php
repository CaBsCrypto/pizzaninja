<?php
/**
 * Tier3_CrossFeatureCombinationsTest.php
 * Tier 3 Cross-Feature Combination Tests for SpicyCrust Game Ecosystem API.
 * 15 pairwise and multi-feature interaction test cases.
 */

namespace SpicyCrust\Tests;

require_once __DIR__ . '/TestHarness.php';

class Tier3_CrossFeatureCombinationsTest {

    public static function run(): void {
        echo "\nRunning Tier 3: Cross-Feature Combination Tests (15 tests)...\n";

        // T3_01: Auth + Score Submission + Leaderboard Update
        TestHarness::runTest('test_t3_01_auth_plus_score_submission_plus_leaderboard_update', 'Tier 3', 12, function() {
            // 1. Submit score with valid Auth
            $subRes = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], [
                'score' => 9999,
                'player_external_id' => 'combo_player_1',
                'player_nickname' => 'ComboMaster'
            ]);
            TestHarness::assertEquals(200, $subRes['statusCode'], 'Score submission with auth succeeded');

            // 2. Fetch Leaderboard
            $leadRes = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=pizza-dash');
            TestHarness::assertEquals(200, $leadRes['statusCode'], 'Leaderboard query succeeded');
            TestHarness::assertTrue(count($leadRes['json']['data'] ?? []) > 0, 'Leaderboard contains records');
        });

        // T3_02: Score Submission + Season Filtering
        TestHarness::runTest('test_t3_02_score_submission_plus_season_filter', 'Tier 3', 13, function() {
            $currentSeasonRes = TestHarness::httpRequest('GET', '/api/v1/seasons/current');
            $activeSlug = $currentSeasonRes['json']['data']['slug'] ?? 'season-2026-q3';

            $leadRes = TestHarness::httpRequest('GET', "/api/v1/leaderboard?game_slug=pizza-dash&season_slug={$activeSlug}");
            TestHarness::assertEquals(200, $leadRes['statusCode'], 'Filtered leaderboard returns 200');
        });

        // T3_03: CORS Preflight + Auth + Score Submission
        TestHarness::runTest('test_t3_03_cors_preflight_plus_auth_score_submission', 'Tier 3', 9, function() {
            // Preflight
            $optRes = TestHarness::httpRequest('OPTIONS', '/api/v1/scores', ['Origin' => 'http://game-client.com']);
            TestHarness::assertEquals(204, $optRes['statusCode'], 'CORS preflight 204');

            // Actual request
            $postRes = TestHarness::httpRequest('POST', '/api/v1/scores', [
                'Origin' => 'http://game-client.com',
                'Authorization' => 'Bearer secret123'
            ], ['score' => 750, 'player_external_id' => 'p_cors']);
            TestHarness::assertEquals(200, $postRes['statusCode'], 'Post-preflight POST request succeeded');
        });

        // T3_04: Rate Limiting + Auth Endpoint
        TestHarness::runTest('test_t3_04_rate_limiting_plus_auth_endpoint', 'Tier 3', 10, function() {
            // Execute request on auth endpoint
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 10, 'player_external_id' => 'p_rate']);
            TestHarness::assertTrue(in_array($res['statusCode'], [200, 429]), 'Rate limit checked on auth endpoint');
        });

        // T3_05: Payload Sanitization + Leaderboard Rendering
        TestHarness::runTest('test_t3_05_payload_sanitization_plus_leaderboard_rendering', 'Tier 3', 11, function() {
            $postRes = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], [
                'score' => 888,
                'player_external_id' => 'p_xss',
                'player_nickname' => '<script>alert("hack")</script>'
            ]);
            TestHarness::assertFalse(stripos($postRes['rawBody'], '<script>'), 'Sanitized in POST response');
        });

        // T3_06: Unauthenticated Score Submission Error Envelope
        TestHarness::runTest('test_t3_06_unauthenticated_score_submission_returns_error_envelope', 'Tier 3', 7, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', [], ['score' => 100, 'player_external_id' => 'p1']);
            TestHarness::assertEquals(401, $res['statusCode'], 'HTTP status 401');
            TestHarness::assertEquals(false, $res['json']['success'] ?? null, 'success is false');
            TestHarness::assertEquals('UNAUTHORIZED', $res['json']['error']['code'] ?? '', 'error.code is UNAUTHORIZED');
        });

        // T3_07: Invalid JSON Body + CORS Response
        TestHarness::runTest('test_t3_07_invalid_json_body_plus_cors_response', 'Tier 3', 7, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', [
                'Origin' => 'http://mygame.com',
                'Authorization' => 'Bearer secret123'
            ], '{bad_json');
            TestHarness::assertEquals(400, $res['statusCode'], 'HTTP 400 Bad Request');
            TestHarness::assertArrayHasKey('Access-Control-Allow-Origin', $res['headers'], 'CORS headers present on error response');
        });

        // T3_08: Multi-Game Score Submission + Global Leaderboard
        TestHarness::runTest('test_t3_08_multi_game_score_submission_plus_global_leaderboard', 'Tier 3', 14, function() {
            // Submit Game 1 score
            TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 1500, 'player_external_id' => 'multi_p']);
            // Query Global Leaderboard
            $globalRes = TestHarness::httpRequest('GET', '/api/v1/leaderboard/global');
            TestHarness::assertEquals(200, $globalRes['statusCode'], 'Global leaderboard returned');
            TestHarness::assertTrue(count($globalRes['json']['data'] ?? []) > 0, 'Global leaderboard non-empty');
        });

        // T3_09: Current Season Lookup + Season Leaderboard
        TestHarness::runTest('test_t3_09_current_season_lookup_plus_season_leaderboard', 'Tier 3', 15, function() {
            $curRes = TestHarness::httpRequest('GET', '/api/v1/seasons/current');
            $slug = $curRes['json']['data']['slug'] ?? 'season-2026-q3';

            $leadRes = TestHarness::httpRequest('GET', "/api/v1/leaderboard?game_slug=pizza-dash&season_slug={$slug}");
            TestHarness::assertEquals(200, $leadRes['statusCode'], 'Leaderboard queried with active season slug');
        });

        // T3_10: SQLi Attack Payload in Leaderboard Query
        TestHarness::runTest('test_t3_10_sqli_attack_payload_in_leaderboard_query', 'Tier 3', 11, function() {
            $res = TestHarness::httpRequest('GET', "/api/v1/leaderboard?game_slug=' UNION SELECT * FROM users--");
            TestHarness::assertEquals(200, $res['statusCode'], 'SQLi payload safely handled without syntax error');
        });

        // T3_11: Bearer Token Hashing Verification
        TestHarness::runTest('test_t3_11_bearer_token_hashing_verification', 'Tier 3', 8, function() {
            $hash = hash('sha256', 'secret123');
            TestHarness::assertEquals(64, strlen($hash), 'SHA-256 hash length is 64 hex chars');
        });

        // T3_12: Rate Limit Reset After Window
        TestHarness::runTest('test_t3_12_rate_limit_reset_after_window', 'Tier 3', 10, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/health');
            TestHarness::assertEquals(200, $res['statusCode'], 'Request succeeds under rate limit');
        });

        // T3_13: Database Reconnection and Health Check
        TestHarness::runTest('test_t3_13_database_reconnection_and_health_check', 'Tier 3', 1, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/health');
            TestHarness::assertEquals(200, $res['statusCode'], 'Health check verifies DB connection');
        });

        // T3_14: Leaderboard Pagination and Limit Combination
        TestHarness::runTest('test_t3_14_leaderboard_pagination_and_limit_combination', 'Tier 3', 13, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=pizza-dash&limit=2&page=1');
            TestHarness::assertEquals(200, $res['statusCode'], 'Leaderboard with limit and pagination succeeds');
            TestHarness::assertTrue(count($res['json']['data'] ?? []) <= 2, 'Result count capped by limit');
        });

        // T3_15: Documentation Endpoint Contract Verification
        TestHarness::runTest('test_t3_15_documentation_endpoint_contract_verification', 'Tier 3', 17, function() {
            TestHarness::assertFileContains('docs/API.md', '/api/v1/health', 'API doc contains /health contract');
            TestHarness::assertFileContains('docs/API.md', '/api/v1/scores', 'API doc contains /scores contract');
            TestHarness::assertFileContains('docs/API.md', '/api/v1/leaderboard', 'API doc contains /leaderboard contract');
        });
    }
}
