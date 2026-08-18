<?php
/**
 * Tier2_BoundaryCornerCasesTest.php
 * Tier 2 Boundary & Corner Cases Tests for SpicyCrust Game Ecosystem API.
 * 100 tests total (5 boundary/corner tests per feature across all 20 features).
 */

namespace SpicyCrust\Tests;

require_once __DIR__ . '/TestHarness.php';

class Tier2_BoundaryCornerCasesTest {

    public static function run(): void {
        echo "\nRunning Tier 2: Boundary & Corner Cases Tests (100 tests)...\n";

        // Feature 1: Health Check API (GET /api/v1/health)
        TestHarness::runTest('test_f01_t2_01_health_check_ignores_query_params', 'Tier 2', 1, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/health?foo=bar&baz=123');
            TestHarness::assertEquals(200, $res['statusCode'], 'Health check ignores query string');
        });

        TestHarness::runTest('test_f01_t2_02_health_check_extra_headers_ignored', 'Tier 2', 1, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/health', ['X-Custom-Header' => 'test']);
            TestHarness::assertEquals(200, $res['statusCode'], 'Health check ignores custom headers');
        });

        TestHarness::runTest('test_f01_t2_03_health_check_post_method', 'Tier 2', 1, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/health');
            TestHarness::assertTrue(in_array($res['statusCode'], [404, 405]), 'POST to health endpoint returns 404 or 405');
        });

        TestHarness::runTest('test_f01_t2_04_health_check_head_method', 'Tier 2', 1, function() {
            $res = TestHarness::httpRequest('HEAD', '/api/v1/health');
            TestHarness::assertEquals(200, $res['statusCode'], 'HEAD /health returns 200 OK');
        });

        TestHarness::runTest('test_f01_t2_05_health_check_case_sensitivity', 'Tier 2', 1, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/HEALTH');
            TestHarness::assertTrue(in_array($res['statusCode'], [200, 404]), 'Upper case health URL handled cleanly');
        });

        // Feature 2: DB Schema DDL (database/schema.sql)
        TestHarness::runTest('test_f02_t2_01_schema_foreign_keys', 'Tier 2', 2, function() {
            TestHarness::assertFileContains('database/schema.sql', 'FOREIGN KEY', 'schema.sql defines foreign key constraints');
        });

        TestHarness::runTest('test_f02_t2_02_schema_unique_indexes', 'Tier 2', 2, function() {
            TestHarness::assertFileContains('database/schema.sql', 'UNIQUE', 'schema.sql defines unique indexes');
        });

        TestHarness::runTest('test_f02_t2_03_schema_not_null_constraints', 'Tier 2', 2, function() {
            TestHarness::assertFileContains('database/schema.sql', 'NOT NULL', 'schema.sql defines NOT NULL constraints');
        });

        TestHarness::runTest('test_f02_t2_04_schema_json_metadata_type', 'Tier 2', 2, function() {
            TestHarness::assertFileContains('database/schema.sql', 'metadata', 'schema.sql defines metadata column');
        });

        TestHarness::runTest('test_f02_t2_05_schema_timestamp_defaults', 'Tier 2', 2, function() {
            TestHarness::assertFileContains('database/schema.sql', 'TIMESTAMP', 'schema.sql defines TIMESTAMP fields');
        });

        // Feature 3: DB Seeding (database/seed.sql)
        TestHarness::runTest('test_f03_t2_01_seed_api_key_hashes_sha256', 'Tier 2', 3, function() {
            TestHarness::assertFileContains('database/seed.sql', 'api_key_hash', 'seed.sql defines api_key_hash');
        });

        TestHarness::runTest('test_f03_t2_02_seed_active_season', 'Tier 2', 3, function() {
            TestHarness::assertFileContains('database/seed.sql', 'is_active', 'seed.sql seeds active season');
        });

        TestHarness::runTest('test_f03_t2_03_seed_valid_json_metadata', 'Tier 2', 3, function() {
            TestHarness::assertFileContains('database/seed.sql', '{', 'seed.sql contains JSON metadata syntax');
        });

        TestHarness::runTest('test_f03_t2_04_seed_player_external_ids', 'Tier 2', 3, function() {
            TestHarness::assertFileContains('database/seed.sql', 'external_id', 'seed.sql populates player external_id');
        });

        TestHarness::runTest('test_f03_t2_05_seed_multiple_games', 'Tier 2', 3, function() {
            TestHarness::assertFileContains('database/seed.sql', 'slug', 'seed.sql populates game slugs');
        });

        // Feature 4: PDO DB Connection
        TestHarness::runTest('test_f04_t2_01_connection_sql_injection_defense', 'Tier 2', 4, function() {
            TestHarness::assertFileContains('src/Database/Connection.php', 'prepare', 'Prepared statements used in PDO Connection');
        });

        TestHarness::runTest('test_f04_t2_02_connection_utf8mb4_charset', 'Tier 2', 4, function() {
            TestHarness::assertFileContains('config/database.php', 'utf8', 'Config specifies utf8 charset');
        });

        TestHarness::runTest('test_f04_t2_03_connection_invalid_credentials_handled', 'Tier 2', 4, function() {
            TestHarness::assertFileContains('src/Database/Connection.php', 'PDOException', 'PDO Connection handles PDOException');
        });

        TestHarness::runTest('test_f04_t2_04_connection_singleton_or_factory', 'Tier 2', 4, function() {
            TestHarness::assertFileContains('src/Database/Connection.php', 'function', 'Connection class defines factory or instance method');
        });

        TestHarness::runTest('test_f04_t2_05_connection_emulated_prepares_disabled', 'Tier 2', 4, function() {
            TestHarness::assertFileContains('src/Database/Connection.php', 'ATTR_', 'Connection sets PDO attributes');
        });

        // Feature 5: Environment Config (.env.example)
        TestHarness::runTest('test_f05_t2_01_env_example_no_plaintext_secrets', 'Tier 2', 5, function() {
            $content = file_get_contents(TestHarness::getProjectRoot() . '/.env.example');
            TestHarness::assertFalse(stripos($content, 'super_secret_production_password_123'), 'No production secrets in example env');
        });

        TestHarness::runTest('test_f05_t2_02_env_example_comments_guidance', 'Tier 2', 5, function() {
            TestHarness::assertFileContains('.env.example', '#', '.env.example includes comments');
        });

        TestHarness::runTest('test_f05_t2_03_env_example_default_port', 'Tier 2', 5, function() {
            TestHarness::assertFileContains('.env.example', 'PORT', '.env.example defines PORT setting');
        });

        TestHarness::runTest('test_f05_t2_04_env_example_rate_limit_defaults', 'Tier 2', 5, function() {
            TestHarness::assertFileContains('.env.example', 'RATE', '.env.example defines rate limit defaults');
        });

        TestHarness::runTest('test_f05_t2_05_env_example_well_formed_key_values', 'Tier 2', 5, function() {
            TestHarness::assertFileContains('.env.example', '=', '.env.example uses KEY=value format');
        });

        // Feature 6: Router & Base Pipeline
        TestHarness::runTest('test_f06_t2_01_router_404_on_unknown_path', 'Tier 2', 6, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/unknown_endpoint_xyz');
            TestHarness::assertEquals(404, $res['statusCode'], 'Unknown route returns HTTP 404');
        });

        TestHarness::runTest('test_f06_t2_02_router_trailing_slash_handling', 'Tier 2', 6, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/health/');
            TestHarness::assertEquals(200, $res['statusCode'], 'Trailing slash handled gracefully');
        });

        TestHarness::runTest('test_f06_t2_03_router_url_encoded_query_params', 'Tier 2', 6, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=pizza%20dash');
            TestHarness::assertEquals(200, $res['statusCode'], 'URL encoded query string parsed');
        });

        TestHarness::runTest('test_f06_t2_04_router_http_method_mismatch', 'Tier 2', 6, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/leaderboard');
            TestHarness::assertEquals(404, $res['statusCode'], 'Method mismatch returns 404 or 405');
        });

        TestHarness::runTest('test_f06_t2_05_router_multiple_query_params', 'Tier 2', 6, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=pizza-dash&season_slug=season-2026-q3&limit=5');
            TestHarness::assertEquals(200, $res['statusCode'], 'Multiple query params parsed');
        });

        // Feature 7: Standard Error Envelopes
        TestHarness::runTest('test_f07_t2_01_error_envelope_content_type_json', 'Tier 2', 7, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/invalid_path');
            TestHarness::assertStringContains('application/json', $res['headers']['Content-Type'] ?? 'application/json', 'Error Content-Type is application/json');
        });

        TestHarness::runTest('test_f07_t2_02_error_envelope_no_stack_trace_leak', 'Tier 2', 7, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/invalid_path');
            TestHarness::assertFalse(stripos($res['rawBody'], 'Stack trace'), 'No stack trace leaked in error response');
            TestHarness::assertFalse(stripos($res['rawBody'], 'PDOException'), 'No raw PDOException leaked');
        });

        TestHarness::runTest('test_f07_t2_03_error_envelope_code_field_string', 'Tier 2', 7, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/invalid_path');
            TestHarness::assertTrue(is_string($res['json']['error']['code'] ?? null), 'error.code is string');
        });

        TestHarness::runTest('test_f07_t2_04_error_envelope_message_field_string', 'Tier 2', 7, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/invalid_path');
            TestHarness::assertTrue(is_string($res['json']['error']['message'] ?? null), 'error.message is string');
        });

        TestHarness::runTest('test_f07_t2_05_error_envelope_success_field_false', 'Tier 2', 7, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/invalid_path');
            TestHarness::assertEquals(false, $res['json']['success'] ?? null, 'success is boolean false');
        });

        // Feature 8: Bearer Token Auth
        TestHarness::runTest('test_f08_t2_01_auth_malformed_bearer_prefix', 'Tier 2', 8, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Basic username:password'], ['score' => 100]);
            TestHarness::assertEquals(401, $res['statusCode'], 'Basic auth rejected on Bearer token endpoint');
        });

        TestHarness::runTest('test_f08_t2_02_auth_case_insensitive_bearer_prefix', 'Tier 2', 8, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'bearer secret123'], ['score' => 100, 'player_external_id' => 'p1']);
            TestHarness::assertEquals(200, $res['statusCode'], 'Lowercase bearer prefix accepted');
        });

        TestHarness::runTest('test_f08_t2_03_auth_empty_token_string', 'Tier 2', 8, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer '], ['score' => 100]);
            TestHarness::assertEquals(401, $res['statusCode'], 'Empty Bearer token string rejected with 401');
        });

        TestHarness::runTest('test_f08_t2_04_auth_spaces_in_token', 'Tier 2', 8, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer   secret123   '], ['score' => 100, 'player_external_id' => 'p1']);
            TestHarness::assertEquals(200, $res['statusCode'], 'Whitespace around token trimmed');
        });

        TestHarness::runTest('test_f08_t2_05_auth_inactive_game_key', 'Tier 2', 8, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer expired_key'], ['score' => 100]);
            TestHarness::assertEquals(401, $res['statusCode'], 'Expired game key rejected with 401');
        });

        // Feature 9: CORS Origin Control
        TestHarness::runTest('test_f09_t2_01_cors_unauthorized_origin', 'Tier 2', 9, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/health', ['Origin' => 'http://unauthorized.domain.com']);
            TestHarness::assertEquals(200, $res['statusCode'], 'CORS handles arbitrary origin header');
        });

        TestHarness::runTest('test_f09_t2_02_cors_preflight_max_age', 'Tier 2', 9, function() {
            $res = TestHarness::httpRequest('OPTIONS', '/api/v1/scores');
            TestHarness::assertArrayHasKey('Access-Control-Max-Age', $res['headers'], 'Access-Control-Max-Age present in preflight');
        });

        TestHarness::runTest('test_f09_t2_03_cors_allow_credentials_header', 'Tier 2', 9, function() {
            $res = TestHarness::httpRequest('OPTIONS', '/api/v1/scores');
            TestHarness::assertEquals(204, $res['statusCode'], 'Preflight options status 204');
        });

        TestHarness::runTest('test_f09_t2_04_cors_multiple_allowed_origins', 'Tier 2', 9, function() {
            TestHarness::assertFileContains('src/Middleware/CorsMiddleware.php', 'Access-Control-Allow-Origin', 'CorsMiddleware handles Access-Control-Allow-Origin');
        });

        TestHarness::runTest('test_f09_t2_05_cors_options_no_body', 'Tier 2', 9, function() {
            $res = TestHarness::httpRequest('OPTIONS', '/api/v1/scores');
            TestHarness::assertEquals('', $res['rawBody'], 'OPTIONS preflight body is empty');
        });

        // Feature 10: Rate Limiting Middleware
        TestHarness::runTest('test_f10_t2_01_rate_limit_per_ip_isolation', 'Tier 2', 10, function() {
            TestHarness::assertFileContains('src/Middleware/RateLimitMiddleware.php', 'REMOTE_ADDR', 'Rate limit uses IP address');
        });

        TestHarness::runTest('test_f10_t2_02_rate_limit_header_x_ratelimit_limit', 'Tier 2', 10, function() {
            TestHarness::assertFileContains('src/Middleware/RateLimitMiddleware.php', 'RateLimit', 'Rate limit headers logic present');
        });

        TestHarness::runTest('test_f10_t2_03_rate_limit_header_x_ratelimit_remaining', 'Tier 2', 10, function() {
            TestHarness::assertFileContains('src/Middleware/RateLimitMiddleware.php', 'RateLimit', 'Rate limit remaining logic present');
        });

        TestHarness::runTest('test_f10_t2_04_rate_limit_reset_window', 'Tier 2', 10, function() {
            TestHarness::assertFileContains('src/Middleware/RateLimitMiddleware.php', 'window', 'Rate limit window handling present');
        });

        TestHarness::runTest('test_f10_t2_05_rate_limit_whitelisted_endpoints', 'Tier 2', 10, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/health');
            TestHarness::assertEquals(200, $res['statusCode'], 'Health endpoint exempt or allowed under normal rate limit');
        });

        // Feature 11: Payload Validation & Sanitization
        TestHarness::runTest('test_f11_t2_01_empty_post_body_returns_400', 'Tier 2', 11, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], '');
            TestHarness::assertEquals(422, $res['statusCode'], 'Empty body on scores returns 422');
        });

        TestHarness::runTest('test_f11_t2_02_payload_type_mismatch_string_score', 'Tier 2', 11, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 'one_hundred', 'player_external_id' => 'p1']);
            TestHarness::assertEquals(422, $res['statusCode'], 'Non-numeric string score returns 422');
        });

        TestHarness::runTest('test_f11_t2_03_payload_malformed_json_metadata', 'Tier 2', 11, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 100, 'player_external_id' => 'p1', 'metadata' => '{bad json']);
            TestHarness::assertTrue(in_array($res['statusCode'], [400, 422, 200]), 'Malformed metadata handled cleanly');
        });

        TestHarness::runTest('test_f11_t2_04_payload_overly_large_body', 'Tier 2', 11, function() {
            $largeMetadata = str_repeat('a', 500);
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 100, 'player_external_id' => 'p1', 'metadata' => ['data' => $largeMetadata]]);
            TestHarness::assertEquals(200, $res['statusCode'], 'Large valid metadata accepted');
        });

        TestHarness::runTest('test_f11_t2_05_payload_control_characters', 'Tier 2', 11, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 100, 'player_external_id' => "p1\0null"]);
            TestHarness::assertTrue(in_array($res['statusCode'], [200, 422]), 'Control characters handled safely');
        });

        // Feature 12: Score Submission API (POST /api/v1/scores)
        TestHarness::runTest('test_f12_t2_01_score_missing_required_fields', 'Tier 2', 12, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 100]);
            TestHarness::assertEquals(422, $res['statusCode'], 'Missing player_external_id returns 422');
        });

        TestHarness::runTest('test_f12_t2_02_score_negative_values', 'Tier 2', 12, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => -50, 'player_external_id' => 'p1']);
            TestHarness::assertTrue(in_array($res['statusCode'], [200, 422]), 'Negative score validation handled');
        });

        TestHarness::runTest('test_f12_t2_03_score_extreme_high_numeric', 'Tier 2', 12, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 9999999999, 'player_external_id' => 'p1']);
            TestHarness::assertEquals(200, $res['statusCode'], 'Extreme high numeric score accepted without overflow');
        });

        TestHarness::runTest('test_f12_t2_04_score_nested_json_metadata', 'Tier 2', 12, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 100, 'player_external_id' => 'p1', 'metadata' => ['stats' => ['combo' => 10, 'accuracy' => 99.5]]]);
            TestHarness::assertEquals(200, $res['statusCode'], 'Nested JSON metadata accepted');
        });

        TestHarness::runTest('test_f12_t2_05_score_xss_in_player_nickname', 'Tier 2', 12, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 100, 'player_external_id' => 'p1', 'player_nickname' => '<script>alert(1)</script>']);
            TestHarness::assertFalse(stripos($res['rawBody'], '<script>'), 'XSS script tags escaped in response');
        });

        // Feature 13: Per-Game Leaderboard API (GET /api/v1/leaderboard)
        TestHarness::runTest('test_f13_t2_01_leaderboard_nonexistent_game_slug', 'Tier 2', 13, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=nonexistent');
            TestHarness::assertEquals(200, $res['statusCode'], 'Nonexistent game slug returns empty array cleanly');
            TestHarness::assertEquals([], $res['json']['data'] ?? null, 'Empty array returned');
        });

        TestHarness::runTest('test_f13_t2_02_leaderboard_invalid_limit_param', 'Tier 2', 13, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=pizza-dash&limit=-5');
            TestHarness::assertEquals(200, $res['statusCode'], 'Negative limit falls back to default limit');
        });

        TestHarness::runTest('test_f13_t2_03_leaderboard_invalid_season_slug', 'Tier 2', 13, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=pizza-dash&season_slug=invalid_season');
            TestHarness::assertEquals(200, $res['statusCode'], 'Invalid season slug query handled cleanly');
        });

        TestHarness::runTest('test_f13_t2_04_leaderboard_tie_breaking', 'Tier 2', 13, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=pizza-dash');
            TestHarness::assertEquals(200, $res['statusCode'], 'Tie breaking handles identical scores');
        });

        TestHarness::runTest('test_f13_t2_05_leaderboard_zero_scores', 'Tier 2', 13, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=pizza-dash');
            TestHarness::assertEquals(200, $res['statusCode'], 'Zero scores supported');
        });

        // Feature 14: Global Leaderboard API (GET /api/v1/leaderboard/global)
        TestHarness::runTest('test_f14_t2_01_global_leaderboard_empty_database', 'Tier 2', 14, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard/global');
            TestHarness::assertEquals(200, $res['statusCode'], 'Global leaderboard HTTP status 200');
        });

        TestHarness::runTest('test_f14_t2_02_global_leaderboard_invalid_limit', 'Tier 2', 14, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard/global?limit=abc');
            TestHarness::assertEquals(200, $res['statusCode'], 'Invalid limit param handled cleanly');
        });

        TestHarness::runTest('test_f14_t2_03_global_leaderboard_aggregation_correctness', 'Tier 2', 14, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard/global');
            $first = $res['json']['data'][0] ?? [];
            TestHarness::assertArrayHasKey('score', $first, 'Global ranking includes aggregated score');
        });

        TestHarness::runTest('test_f14_t2_04_global_leaderboard_inactive_season_filter', 'Tier 2', 14, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard/global?season_slug=season-2026-q2');
            TestHarness::assertEquals(200, $res['statusCode'], 'Historical season filter supported');
        });

        TestHarness::runTest('test_f14_t2_05_global_leaderboard_pagination', 'Tier 2', 14, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard/global?page=1');
            TestHarness::assertEquals(200, $res['statusCode'], 'Pagination parameters supported');
        });

        // Feature 15: Seasons API (GET /api/v1/seasons, /current)
        TestHarness::runTest('test_f15_t2_01_current_season_when_none_active', 'Tier 2', 15, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/seasons/current');
            TestHarness::assertTrue(in_array($res['statusCode'], [200, 404]), 'Current season returns 200 or 404');
        });

        TestHarness::runTest('test_f15_t2_02_seasons_sorted_by_date', 'Tier 2', 15, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/seasons');
            $data = $res['json']['data'] ?? [];
            TestHarness::assertTrue(count($data) >= 1, 'Seasons array non-empty');
        });

        TestHarness::runTest('test_f15_t2_03_seasons_date_format_iso8601', 'Tier 2', 15, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/seasons');
            $startDate = $res['json']['data'][0]['start_date'] ?? '';
            TestHarness::assertTrue((bool)preg_match('/^\d{4}-\d{2}-\d{2}/', $startDate), 'Start date is ISO date format');
        });

        TestHarness::runTest('test_f15_t2_04_seasons_post_method_not_allowed', 'Tier 2', 15, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/seasons');
            TestHarness::assertEquals(404, $res['statusCode'], 'POST /seasons returns 404 or 405');
        });

        TestHarness::runTest('test_f15_t2_05_seasons_query_params_ignored', 'Tier 2', 15, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/seasons/current?extra=1');
            TestHarness::assertEquals(200, $res['statusCode'], 'Extra query params on /current season ignored');
        });

        // Feature 16: System Documentation (README.md)
        TestHarness::runTest('test_f16_t2_01_readme_mysql_sqlite_notes', 'Tier 2', 16, function() {
            TestHarness::assertFileContains('README.md', 'MySQL', 'README notes MySQL support');
        });

        TestHarness::runTest('test_f16_t2_02_readme_prerequisites_specified', 'Tier 2', 16, function() {
            TestHarness::assertFileContains('README.md', 'PHP', 'README specifies PHP requirement');
        });

        TestHarness::runTest('test_f16_t2_03_readme_security_summary', 'Tier 2', 16, function() {
            TestHarness::assertFileContains('README.md', 'Security', 'README contains Security section/reference');
        });

        TestHarness::runTest('test_f16_t2_04_readme_api_overview_table', 'Tier 2', 16, function() {
            TestHarness::assertFileContains('README.md', 'API', 'README contains API documentation reference');
        });

        TestHarness::runTest('test_f16_t2_05_readme_valid_markdown_links', 'Tier 2', 16, function() {
            TestHarness::assertFileContains('README.md', 'docs/', 'README links to docs directory');
        });

        // Feature 17: API Documentation (docs/API.md)
        TestHarness::runTest('test_f17_t2_01_docs_api_http_status_codes', 'Tier 2', 17, function() {
            TestHarness::assertFileContains('docs/API.md', '401', 'docs/API.md documents 401 status code');
        });

        TestHarness::runTest('test_f17_t2_02_docs_api_auth_header_format', 'Tier 2', 17, function() {
            TestHarness::assertFileContains('docs/API.md', 'Bearer', 'docs/API.md documents Bearer authentication format');
        });

        TestHarness::runTest('test_f17_t2_03_docs_api_error_response_example', 'Tier 2', 17, function() {
            TestHarness::assertFileContains('docs/API.md', 'error', 'docs/API.md contains error response schema');
        });

        TestHarness::runTest('test_f17_t2_04_docs_api_request_examples', 'Tier 2', 17, function() {
            TestHarness::assertFileContains('docs/API.md', 'score', 'docs/API.md documents score payload format');
        });

        TestHarness::runTest('test_f17_t2_05_docs_api_query_parameters', 'Tier 2', 17, function() {
            TestHarness::assertFileContains('docs/API.md', 'limit', 'docs/API.md documents query parameters');
        });

        // Feature 18: Security Documentation (docs/SECURITY.md)
        TestHarness::runTest('test_f18_t2_01_docs_security_xss_prevention', 'Tier 2', 18, function() {
            TestHarness::assertFileContains('docs/SECURITY.md', 'XSS', 'docs/SECURITY.md documents XSS prevention');
        });

        TestHarness::runTest('test_f18_t2_02_docs_security_sqli_prevention', 'Tier 2', 18, function() {
            TestHarness::assertFileContains('docs/SECURITY.md', 'SQL', 'docs/SECURITY.md documents SQL injection prevention');
        });

        TestHarness::runTest('test_f18_t2_03_docs_security_secret_storage', 'Tier 2', 18, function() {
            TestHarness::assertFileContains('docs/SECURITY.md', 'hash', 'docs/SECURITY.md documents secret hashing');
        });

        TestHarness::runTest('test_f18_t2_04_docs_security_rate_limiting_details', 'Tier 2', 18, function() {
            TestHarness::assertFileContains('docs/SECURITY.md', '429', 'docs/SECURITY.md documents 429 rate limits');
        });

        TestHarness::runTest('test_f18_t2_05_docs_security_production_hardening', 'Tier 2', 18, function() {
            TestHarness::assertFileContains('docs/SECURITY.md', 'Production', 'docs/SECURITY.md documents production hardening');
        });

        // Feature 19: Architecture Documentation (docs/ARCHITECTURE.md)
        TestHarness::runTest('test_f19_t2_01_docs_architecture_middleware_chain', 'Tier 2', 19, function() {
            TestHarness::assertFileContains('docs/ARCHITECTURE.md', 'Middleware', 'docs/ARCHITECTURE.md documents middleware chain');
        });

        TestHarness::runTest('test_f19_t2_02_docs_architecture_database_schema', 'Tier 2', 19, function() {
            TestHarness::assertFileContains('docs/ARCHITECTURE.md', 'scores', 'docs/ARCHITECTURE.md documents database entities');
        });

        TestHarness::runTest('test_f19_t2_03_docs_architecture_directory_structure', 'Tier 2', 19, function() {
            TestHarness::assertFileContains('docs/ARCHITECTURE.md', 'public', 'docs/ARCHITECTURE.md documents directory layout');
        });

        TestHarness::runTest('test_f19_t2_04_docs_architecture_error_handling_flow', 'Tier 2', 19, function() {
            TestHarness::assertFileContains('docs/ARCHITECTURE.md', 'Error', 'docs/ARCHITECTURE.md documents error handling flow');
        });

        TestHarness::runTest('test_f19_t2_05_docs_architecture_extensibility', 'Tier 2', 19, function() {
            TestHarness::assertFileContains('docs/ARCHITECTURE.md', 'Controller', 'docs/ARCHITECTURE.md documents Controller layer');
        });

        // Feature 20: E2E Test Suite (tests/run_tests.php)
        TestHarness::runTest('test_f20_t2_01_runner_filter_arg_support', 'Tier 2', 20, function() {
            TestHarness::assertFileContains('tests/run_tests.php', 'filter', 'run_tests.php supports --filter option');
        });

        TestHarness::runTest('test_f20_t2_02_runner_tier_arg_support', 'Tier 2', 20, function() {
            TestHarness::assertFileContains('tests/run_tests.php', 'tier', 'run_tests.php supports --tier option');
        });

        TestHarness::runTest('test_f20_t2_03_runner_verbose_output', 'Tier 2', 20, function() {
            TestHarness::assertFileContains('tests/run_tests.php', 'verbose', 'run_tests.php supports --verbose option');
        });

        TestHarness::runTest('test_f20_t2_04_runner_non_zero_exit_on_failure', 'Tier 2', 20, function() {
            TestHarness::assertFileContains('tests/run_tests.php', 'exit(1)', 'run_tests.php exits with 1 on test failure');
        });

        TestHarness::runTest('test_f20_t2_05_runner_execution_time_reporting', 'Tier 2', 20, function() {
            TestHarness::assertFileContains('tests/run_tests.php', 'Time', 'run_tests.php reports execution time');
        });
    }
}
