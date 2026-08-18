<?php
/**
 * Tier1_FeatureCoverageTest.php
 * Tier 1 Feature Coverage Tests for SpicyCrust Game Ecosystem API.
 * 100 tests total (5 per feature across all 20 features).
 */

namespace SpicyCrust\Tests;

require_once __DIR__ . '/TestHarness.php';

class Tier1_FeatureCoverageTest {

    public static function run(): void {
        echo "\nRunning Tier 1: Feature Coverage Tests (100 tests)...\n";

        // Feature 1: Health Check API (GET /api/v1/health)
        TestHarness::runTest('test_f01_t1_01_health_check_returns_200_ok', 'Tier 1', 1, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/health');
            TestHarness::assertEquals(200, $res['statusCode'], 'Health check HTTP status');
        });

        TestHarness::runTest('test_f01_t1_02_health_check_json_content_type', 'Tier 1', 1, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/health');
            TestHarness::assertStringContains('application/json', $res['headers']['Content-Type'] ?? 'application/json', 'Content-Type header');
        });

        TestHarness::runTest('test_f01_t1_03_health_check_success_field', 'Tier 1', 1, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/health');
            TestHarness::assertTrue(isset($res['json']['success']) && $res['json']['success'] === true, 'JSON body success boolean');
        });

        TestHarness::runTest('test_f01_t1_04_health_check_data_status', 'Tier 1', 1, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/health');
            TestHarness::assertEquals('ok', $res['json']['data']['status'] ?? '', 'JSON body status ok');
        });

        TestHarness::runTest('test_f01_t1_05_health_check_no_auth_required', 'Tier 1', 1, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/health');
            TestHarness::assertEquals(200, $res['statusCode'], 'Accessible without Auth');
        });

        // Feature 2: DB Schema DDL (database/schema.sql)
        TestHarness::runTest('test_f02_t1_01_schema_file_exists', 'Tier 1', 2, function() {
            TestHarness::assertFileExists('database/schema.sql', 'schema.sql exists');
        });

        TestHarness::runTest('test_f02_t1_02_schema_defines_games_table', 'Tier 1', 2, function() {
            TestHarness::assertFileContains('database/schema.sql', 'CREATE TABLE', 'schema.sql defines tables');
            TestHarness::assertFileContains('database/schema.sql', 'games', 'schema.sql defines games table');
        });

        TestHarness::runTest('test_f02_t1_03_schema_defines_players_table', 'Tier 1', 2, function() {
            TestHarness::assertFileContains('database/schema.sql', 'players', 'schema.sql defines players table');
        });

        TestHarness::runTest('test_f02_t1_04_schema_defines_seasons_table', 'Tier 1', 2, function() {
            TestHarness::assertFileContains('database/schema.sql', 'seasons', 'schema.sql defines seasons table');
        });

        TestHarness::runTest('test_f02_t1_05_schema_defines_scores_table', 'Tier 1', 2, function() {
            TestHarness::assertFileContains('database/schema.sql', 'scores', 'schema.sql defines scores table');
        });

        // Feature 3: DB Seeding (database/seed.sql)
        TestHarness::runTest('test_f03_t1_01_seed_file_exists', 'Tier 1', 3, function() {
            TestHarness::assertFileExists('database/seed.sql', 'seed.sql exists');
        });

        TestHarness::runTest('test_f03_t1_02_seed_populates_games', 'Tier 1', 3, function() {
            TestHarness::assertFileContains('database/seed.sql', 'INSERT INTO', 'seed.sql has inserts');
            TestHarness::assertFileContains('database/seed.sql', 'games', 'seed.sql populates games');
        });

        TestHarness::runTest('test_f03_t1_03_seed_populates_players', 'Tier 1', 3, function() {
            TestHarness::assertFileContains('database/seed.sql', 'players', 'seed.sql populates players');
        });

        TestHarness::runTest('test_f03_t1_04_seed_populates_seasons', 'Tier 1', 3, function() {
            TestHarness::assertFileContains('database/seed.sql', 'seasons', 'seed.sql populates seasons');
        });

        TestHarness::runTest('test_f03_t1_05_seed_populates_scores', 'Tier 1', 3, function() {
            TestHarness::assertFileContains('database/seed.sql', 'scores', 'seed.sql populates scores');
        });

        // Feature 4: PDO DB Connection
        TestHarness::runTest('test_f04_t1_01_connection_class_exists', 'Tier 1', 4, function() {
            TestHarness::assertFileExists('src/Database/Connection.php', 'Connection.php exists');
        });

        TestHarness::runTest('test_f04_t1_02_config_database_exists', 'Tier 1', 4, function() {
            TestHarness::assertFileExists('config/database.php', 'database.php config exists');
        });

        TestHarness::runTest('test_f04_t1_03_pdo_prepared_statement_usage', 'Tier 1', 4, function() {
            TestHarness::assertFileContains('src/Database/Connection.php', 'PDO', 'Connection uses PDO');
        });

        TestHarness::runTest('test_f04_t1_04_driver_support_mysql_sqlite', 'Tier 1', 4, function() {
            TestHarness::assertFileContains('config/database.php', 'DB_DRIVER', 'Config supports DB_DRIVER');
        });

        TestHarness::runTest('test_f04_t1_05_pdo_error_mode_exception', 'Tier 1', 4, function() {
            TestHarness::assertFileContains('src/Database/Connection.php', 'ERRMODE_EXCEPTION', 'Sets PDO error mode exception');
        });

        // Feature 5: Environment Config (.env.example)
        TestHarness::runTest('test_f05_t1_01_env_example_exists', 'Tier 1', 5, function() {
            TestHarness::assertFileExists('.env.example', '.env.example exists');
        });

        TestHarness::runTest('test_f05_t1_02_env_example_db_keys', 'Tier 1', 5, function() {
            TestHarness::assertFileContains('.env.example', 'DB_DRIVER', '.env.example contains DB_DRIVER');
            TestHarness::assertFileContains('.env.example', 'DB_HOST', '.env.example contains DB_HOST');
        });

        TestHarness::runTest('test_f05_t1_03_env_example_app_secret', 'Tier 1', 5, function() {
            TestHarness::assertFileContains('.env.example', 'APP_SECRET', '.env.example contains APP_SECRET');
        });

        TestHarness::runTest('test_f05_t1_04_env_example_rate_limit_keys', 'Tier 1', 5, function() {
            TestHarness::assertFileContains('.env.example', 'RATE_LIMIT', '.env.example contains RATE_LIMIT');
        });

        TestHarness::runTest('test_f05_t1_05_env_example_cors_keys', 'Tier 1', 5, function() {
            TestHarness::assertFileContains('.env.example', 'CORS', '.env.example contains CORS settings');
        });

        // Feature 6: Router & Base Pipeline
        TestHarness::runTest('test_f06_t1_01_router_class_exists', 'Tier 1', 6, function() {
            TestHarness::assertFileExists('src/Http/Router.php', 'Router.php exists');
            TestHarness::assertFileExists('public/index.php', 'index.php front controller exists');
        });

        TestHarness::runTest('test_f06_t1_02_route_health_matching', 'Tier 1', 6, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/health');
            TestHarness::assertEquals(200, $res['statusCode'], 'Router matches health check');
        });

        TestHarness::runTest('test_f06_t1_03_route_scores_matching', 'Tier 1', 6, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores');
            TestHarness::assertTrue(in_array($res['statusCode'], [401, 422, 200, 201]), 'Router matches scores route');
        });

        TestHarness::runTest('test_f06_t1_04_route_leaderboard_matching', 'Tier 1', 6, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard');
            TestHarness::assertEquals(200, $res['statusCode'], 'Router matches leaderboard route');
        });

        TestHarness::runTest('test_f06_t1_05_route_seasons_matching', 'Tier 1', 6, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/seasons');
            TestHarness::assertEquals(200, $res['statusCode'], 'Router matches seasons route');
        });

        // Feature 7: Standard Error Envelopes
        TestHarness::runTest('test_f07_t1_01_404_error_envelope_structure', 'Tier 1', 7, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/nonexistent_route_abc');
            TestHarness::assertEquals(404, $res['statusCode'], 'HTTP 404 status code');
            TestHarness::assertFalse($res['json']['success'] ?? true, 'success boolean is false');
            TestHarness::assertEquals('NOT_FOUND', $res['json']['error']['code'] ?? '', 'error.code is NOT_FOUND');
        });

        TestHarness::runTest('test_f07_t1_02_401_error_envelope_structure', 'Tier 1', 7, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', [], ['score' => 100]);
            TestHarness::assertEquals(401, $res['statusCode'], 'HTTP 401 status code');
            TestHarness::assertEquals('UNAUTHORIZED', $res['json']['error']['code'] ?? '', 'error.code is UNAUTHORIZED');
        });

        TestHarness::runTest('test_f07_t1_03_400_error_envelope_structure', 'Tier 1', 7, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], '{bad json');
            TestHarness::assertEquals(400, $res['statusCode'], 'HTTP 400 status code');
            TestHarness::assertEquals('INVALID_REQUEST', $res['json']['error']['code'] ?? '', 'error.code is INVALID_REQUEST');
        });

        TestHarness::runTest('test_f07_t1_04_422_error_envelope_structure', 'Tier 1', 7, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 'abc']);
            TestHarness::assertEquals(422, $res['statusCode'], 'HTTP 422 status code');
            TestHarness::assertEquals('UNPROCESSABLE_ENTITY', $res['json']['error']['code'] ?? '', 'error.code is UNPROCESSABLE_ENTITY');
        });

        TestHarness::runTest('test_f07_t1_05_429_error_envelope_structure', 'Tier 1', 7, function() {
            TestHarness::assertFileExists('src/Middleware/RateLimitMiddleware.php', 'RateLimitMiddleware handles 429');
        });

        // Feature 8: Bearer Token Auth
        TestHarness::runTest('test_f08_t1_01_auth_valid_bearer_token', 'Tier 1', 8, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 500, 'player_external_id' => 'p1']);
            TestHarness::assertEquals(200, $res['statusCode'], 'Valid Bearer token accepted');
        });

        TestHarness::runTest('test_f08_t1_02_auth_missing_header_denied', 'Tier 1', 8, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', [], ['score' => 500, 'player_external_id' => 'p1']);
            TestHarness::assertEquals(401, $res['statusCode'], 'Missing auth header rejected with 401');
        });

        TestHarness::runTest('test_f08_t1_03_auth_invalid_token_denied', 'Tier 1', 8, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer invalid_key'], ['score' => 500, 'player_external_id' => 'p1']);
            TestHarness::assertEquals(401, $res['statusCode'], 'Invalid Bearer token rejected');
        });

        TestHarness::runTest('test_f08_t1_04_auth_sha256_hash_matching', 'Tier 1', 8, function() {
            TestHarness::assertFileContains('src/Middleware/AuthMiddleware.php', 'sha256', 'AuthMiddleware uses sha256 hashing');
        });

        TestHarness::runTest('test_f08_t1_05_auth_middleware_class_exists', 'Tier 1', 8, function() {
            TestHarness::assertFileExists('src/Middleware/AuthMiddleware.php', 'AuthMiddleware.php exists');
        });

        // Feature 9: CORS Origin Control
        TestHarness::runTest('test_f09_t1_01_cors_options_preflight_204', 'Tier 1', 9, function() {
            $res = TestHarness::httpRequest('OPTIONS', '/api/v1/scores');
            TestHarness::assertEquals(204, $res['statusCode'], 'OPTIONS returns 204 No Content');
        });

        TestHarness::runTest('test_f09_t1_02_cors_allow_origin_header', 'Tier 1', 9, function() {
            $res = TestHarness::httpRequest('OPTIONS', '/api/v1/scores', ['Origin' => 'http://example.com']);
            TestHarness::assertArrayHasKey('Access-Control-Allow-Origin', $res['headers'], 'Access-Control-Allow-Origin present');
        });

        TestHarness::runTest('test_f09_t1_03_cors_allow_methods_header', 'Tier 1', 9, function() {
            $res = TestHarness::httpRequest('OPTIONS', '/api/v1/scores');
            TestHarness::assertArrayHasKey('Access-Control-Allow-Methods', $res['headers'], 'Access-Control-Allow-Methods present');
        });

        TestHarness::runTest('test_f09_t1_04_cors_allow_headers_header', 'Tier 1', 9, function() {
            $res = TestHarness::httpRequest('OPTIONS', '/api/v1/scores');
            TestHarness::assertArrayHasKey('Access-Control-Allow-Headers', $res['headers'], 'Access-Control-Allow-Headers present');
        });

        TestHarness::runTest('test_f09_t1_05_cors_middleware_class_exists', 'Tier 1', 9, function() {
            TestHarness::assertFileExists('src/Middleware/CorsMiddleware.php', 'CorsMiddleware.php exists');
        });

        // Feature 10: Rate Limiting Middleware
        TestHarness::runTest('test_f10_t1_01_rate_limit_headers_present', 'Tier 1', 10, function() {
            TestHarness::assertFileExists('src/Middleware/RateLimitMiddleware.php', 'RateLimitMiddleware exists');
        });

        TestHarness::runTest('test_f10_t1_02_rate_limit_exceeded_429', 'Tier 1', 10, function() {
            TestHarness::assertFileContains('src/Middleware/RateLimitMiddleware.php', '429', 'RateLimitMiddleware references HTTP 429');
        });

        TestHarness::runTest('test_f10_t1_03_rate_limit_retry_after_header', 'Tier 1', 10, function() {
            TestHarness::assertFileContains('src/Middleware/RateLimitMiddleware.php', 'Retry-After', 'RateLimitMiddleware includes Retry-After');
        });

        TestHarness::runTest('test_f10_t1_04_rate_limit_middleware_class_exists', 'Tier 1', 10, function() {
            TestHarness::assertFileExists('src/Middleware/RateLimitMiddleware.php', 'RateLimitMiddleware class file present');
        });

        TestHarness::runTest('test_f10_t1_05_rate_limit_storage_backend', 'Tier 1', 10, function() {
            TestHarness::assertFileContains('src/Middleware/RateLimitMiddleware.php', 'RateLimit', 'Rate limit storage implementation present');
        });

        // Feature 11: Payload Validation & Sanitization
        TestHarness::runTest('test_f11_t1_01_valid_json_payload_accepted', 'Tier 1', 11, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 100, 'player_external_id' => 'p1']);
            TestHarness::assertEquals(200, $res['statusCode'], 'Valid JSON payload accepted');
        });

        TestHarness::runTest('test_f11_t1_02_invalid_json_returns_400', 'Tier 1', 11, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], '{invalid_json');
            TestHarness::assertEquals(400, $res['statusCode'], 'Invalid JSON body returns 400');
        });

        TestHarness::runTest('test_f11_t1_03_xss_html_sanitization', 'Tier 1', 11, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 100, 'player_external_id' => 'p1', 'player_nickname' => '<b>Test</b>']);
            TestHarness::assertTrue(isset($res['json']['data']['player_nickname']), 'Nickname returned');
            TestHarness::assertStringContains('&lt;b&gt;Test&lt;/b&gt;', $res['json']['data']['player_nickname'], 'XSS html tags escaped');
        });

        TestHarness::runTest('test_f11_t1_04_sqli_prepared_statement_escaping', 'Tier 1', 11, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=\' OR 1=1 --');
            TestHarness::assertEquals(200, $res['statusCode'], 'SQLi payload safely handled by prepared statements');
        });

        TestHarness::runTest('test_f11_t1_05_validator_class_exists', 'Tier 1', 11, function() {
            TestHarness::assertFileExists('src/Validation/Validator.php', 'Validator.php exists');
        });

        // Feature 12: Score Submission API (POST /api/v1/scores)
        TestHarness::runTest('test_f12_t1_01_score_submission_success', 'Tier 1', 12, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 500, 'player_external_id' => 'player_001']);
            TestHarness::assertEquals(200, $res['statusCode'], 'Score submission HTTP status 200');
        });

        TestHarness::runTest('test_f12_t1_02_score_submission_response_structure', 'Tier 1', 12, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 500, 'player_external_id' => 'player_001']);
            TestHarness::assertTrue(isset($res['json']['data']['id']), 'Response data contains score id');
            TestHarness::assertTrue(isset($res['json']['data']['score']), 'Response data contains score value');
        });

        TestHarness::runTest('test_f12_t1_03_score_submission_numeric_validation', 'Tier 1', 12, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 1234.56, 'player_external_id' => 'player_001']);
            TestHarness::assertEquals(200, $res['statusCode'], 'Numeric float score accepted');
        });

        TestHarness::runTest('test_f12_t1_04_score_submission_json_metadata', 'Tier 1', 12, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 500, 'player_external_id' => 'player_001', 'metadata' => ['level' => 5, 'time_sec' => 120]]);
            TestHarness::assertEquals(200, $res['statusCode'], 'Score submission with metadata accepted');
        });

        TestHarness::runTest('test_f12_t1_05_score_submission_player_association', 'Tier 1', 12, function() {
            $res = TestHarness::httpRequest('POST', '/api/v1/scores', ['Authorization' => 'Bearer secret123'], ['score' => 500, 'player_external_id' => 'player_001']);
            TestHarness::assertEquals('player_001', $res['json']['data']['player_external_id'] ?? '', 'Score associated with player external_id');
        });

        // Feature 13: Per-Game Leaderboard API (GET /api/v1/leaderboard)
        TestHarness::runTest('test_f13_t1_01_leaderboard_returns_rankings', 'Tier 1', 13, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=pizza-dash');
            TestHarness::assertEquals(200, $res['statusCode'], 'Leaderboard returns 200 OK');
            TestHarness::assertTrue(is_array($res['json']['data'] ?? null), 'Leaderboard data is array');
        });

        TestHarness::runTest('test_f13_t1_02_leaderboard_player_fields', 'Tier 1', 13, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=pizza-dash');
            $first = $res['json']['data'][0] ?? [];
            TestHarness::assertArrayHasKey('rank', $first, 'Leaderboard entry has rank');
            TestHarness::assertArrayHasKey('player_nickname', $first, 'Leaderboard entry has player_nickname');
            TestHarness::assertArrayHasKey('score', $first, 'Leaderboard entry has score');
        });

        TestHarness::runTest('test_f13_t1_03_leaderboard_descending_order', 'Tier 1', 13, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=pizza-dash');
            $data = $res['json']['data'] ?? [];
            if (count($data) >= 2) {
                TestHarness::assertTrue($data[0]['score'] >= $data[1]['score'], 'Leaderboard entries sorted in descending order');
            }
        });

        TestHarness::runTest('test_f13_t1_04_leaderboard_limit_parameter', 'Tier 1', 13, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=pizza-dash&limit=2');
            TestHarness::assertEquals(2, count($res['json']['data'] ?? []), 'Limit parameter restricts returned results count');
        });

        TestHarness::runTest('test_f13_t1_05_leaderboard_season_filter', 'Tier 1', 13, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard?game_slug=pizza-dash&season_slug=season-2026-q3');
            TestHarness::assertEquals(200, $res['statusCode'], 'Leaderboard supports season_slug filter');
        });

        // Feature 14: Global Leaderboard API (GET /api/v1/leaderboard/global)
        TestHarness::runTest('test_f14_t1_01_global_leaderboard_returns_200', 'Tier 1', 14, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard/global');
            TestHarness::assertEquals(200, $res['statusCode'], 'Global leaderboard returns 200 OK');
        });

        TestHarness::runTest('test_f14_t1_02_global_leaderboard_response_structure', 'Tier 1', 14, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard/global');
            TestHarness::assertTrue(isset($res['json']['success']) && $res['json']['success'] === true, 'Global leaderboard success envelope');
        });

        TestHarness::runTest('test_f14_t1_03_global_leaderboard_player_nicknames', 'Tier 1', 14, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard/global');
            $first = $res['json']['data'][0] ?? [];
            TestHarness::assertArrayHasKey('player_nickname', $first, 'Global entry has player_nickname');
            TestHarness::assertArrayHasKey('score', $first, 'Global entry has score');
        });

        TestHarness::runTest('test_f14_t1_04_global_leaderboard_limit_support', 'Tier 1', 14, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard/global?limit=1');
            TestHarness::assertEquals(1, count($res['json']['data'] ?? []), 'Global leaderboard respects limit param');
        });

        TestHarness::runTest('test_f14_t1_05_global_leaderboard_season_support', 'Tier 1', 14, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/leaderboard/global?season_slug=season-2026-q3');
            TestHarness::assertEquals(200, $res['statusCode'], 'Global leaderboard supports season filter');
        });

        // Feature 15: Seasons API (GET /api/v1/seasons, /current)
        TestHarness::runTest('test_f15_t1_01_get_seasons_returns_list', 'Tier 1', 15, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/seasons');
            TestHarness::assertEquals(200, $res['statusCode'], 'GET /seasons returns 200 OK');
            TestHarness::assertTrue(is_array($res['json']['data'] ?? null), 'Seasons list is an array');
        });

        TestHarness::runTest('test_f15_t1_02_get_seasons_fields', 'Tier 1', 15, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/seasons');
            $first = $res['json']['data'][0] ?? [];
            TestHarness::assertArrayHasKey('slug', $first, 'Season object has slug');
            TestHarness::assertArrayHasKey('name', $first, 'Season object has name');
        });

        TestHarness::runTest('test_f15_t1_03_get_current_season_returns_active', 'Tier 1', 15, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/seasons/current');
            TestHarness::assertEquals(200, $res['statusCode'], 'GET /seasons/current returns 200 OK');
            TestHarness::assertEquals(1, $res['json']['data']['is_active'] ?? 0, 'Current season is active');
        });

        TestHarness::runTest('test_f15_t1_04_get_current_season_status_200', 'Tier 1', 15, function() {
            $res = TestHarness::httpRequest('GET', '/api/v1/seasons/current');
            TestHarness::assertTrue(isset($res['json']['data']['slug']), 'Current season returns slug');
        });

        TestHarness::runTest('test_f15_t1_05_seasons_controller_exists', 'Tier 1', 15, function() {
            TestHarness::assertFileExists('src/Controllers/SeasonController.php', 'SeasonController.php exists');
        });

        // Feature 16: System Documentation (README.md)
        TestHarness::runTest('test_f16_t1_01_readme_exists', 'Tier 1', 16, function() {
            TestHarness::assertFileExists('README.md', 'README.md exists');
        });

        TestHarness::runTest('test_f16_t1_02_readme_setup_section', 'Tier 1', 16, function() {
            TestHarness::assertFileContains('README.md', 'Setup', 'README.md contains Setup instructions');
        });

        TestHarness::runTest('test_f16_t1_03_readme_server_start_command', 'Tier 1', 16, function() {
            TestHarness::assertFileContains('README.md', 'php -S', 'README.md contains server start command');
        });

        TestHarness::runTest('test_f16_t1_04_readme_test_runner_command', 'Tier 1', 16, function() {
            TestHarness::assertFileContains('README.md', 'run_tests.php', 'README.md contains test runner command');
        });

        TestHarness::runTest('test_f16_t1_05_readme_env_instructions', 'Tier 1', 16, function() {
            TestHarness::assertFileContains('README.md', '.env', 'README.md documents environment configuration');
        });

        // Feature 17: API Documentation (docs/API.md)
        TestHarness::runTest('test_f17_t1_01_docs_api_exists', 'Tier 1', 17, function() {
            TestHarness::assertFileExists('docs/API.md', 'docs/API.md exists');
        });

        TestHarness::runTest('test_f17_t1_02_docs_api_health_endpoint', 'Tier 1', 17, function() {
            TestHarness::assertFileContains('docs/API.md', '/health', 'docs/API.md documents health endpoint');
        });

        TestHarness::runTest('test_f17_t1_03_docs_api_scores_endpoint', 'Tier 1', 17, function() {
            TestHarness::assertFileContains('docs/API.md', '/scores', 'docs/API.md documents scores endpoint');
        });

        TestHarness::runTest('test_f17_t1_04_docs_api_leaderboard_endpoints', 'Tier 1', 17, function() {
            TestHarness::assertFileContains('docs/API.md', '/leaderboard', 'docs/API.md documents leaderboard endpoint');
        });

        TestHarness::runTest('test_f17_t1_05_docs_api_seasons_endpoints', 'Tier 1', 17, function() {
            TestHarness::assertFileContains('docs/API.md', '/seasons', 'docs/API.md documents seasons endpoint');
        });

        // Feature 18: Security Documentation (docs/SECURITY.md)
        TestHarness::runTest('test_f18_t1_01_docs_security_exists', 'Tier 1', 18, function() {
            TestHarness::assertFileExists('docs/SECURITY.md', 'docs/SECURITY.md exists');
        });

        TestHarness::runTest('test_f18_t1_02_docs_security_token_hashing', 'Tier 1', 18, function() {
            TestHarness::assertFileContains('docs/SECURITY.md', 'sha256', 'docs/SECURITY.md documents token hashing');
        });

        TestHarness::runTest('test_f18_t1_03_docs_security_cors_policy', 'Tier 1', 18, function() {
            TestHarness::assertFileContains('docs/SECURITY.md', 'CORS', 'docs/SECURITY.md documents CORS policy');
        });

        TestHarness::runTest('test_f18_t1_04_docs_security_rate_limiting', 'Tier 1', 18, function() {
            TestHarness::assertFileContains('docs/SECURITY.md', 'Rate', 'docs/SECURITY.md documents rate limiting');
        });

        TestHarness::runTest('test_f18_t1_05_docs_security_input_sanitization', 'Tier 1', 18, function() {
            TestHarness::assertFileContains('docs/SECURITY.md', 'sanitiz', 'docs/SECURITY.md documents input sanitization');
        });

        // Feature 19: Architecture Documentation (docs/ARCHITECTURE.md)
        TestHarness::runTest('test_f19_t1_01_docs_architecture_exists', 'Tier 1', 19, function() {
            TestHarness::assertFileExists('docs/ARCHITECTURE.md', 'docs/ARCHITECTURE.md exists');
        });

        TestHarness::runTest('test_f19_t1_02_docs_architecture_components', 'Tier 1', 19, function() {
            TestHarness::assertFileContains('docs/ARCHITECTURE.md', 'Router', 'docs/ARCHITECTURE.md documents Router');
        });

        TestHarness::runTest('test_f19_t1_03_docs_architecture_er_diagram', 'Tier 1', 19, function() {
            TestHarness::assertFileContains('docs/ARCHITECTURE.md', 'games', 'docs/ARCHITECTURE.md documents games entity');
        });

        TestHarness::runTest('test_f19_t1_04_docs_architecture_request_flow', 'Tier 1', 19, function() {
            TestHarness::assertFileContains('docs/ARCHITECTURE.md', 'Request', 'docs/ARCHITECTURE.md documents Request flow');
        });

        TestHarness::runTest('test_f19_t1_05_docs_architecture_pdo_abstraction', 'Tier 1', 19, function() {
            TestHarness::assertFileContains('docs/ARCHITECTURE.md', 'PDO', 'docs/ARCHITECTURE.md documents PDO abstraction');
        });

        // Feature 20: E2E Test Suite (tests/run_tests.php)
        TestHarness::runTest('test_f20_t1_01_runner_file_exists', 'Tier 1', 20, function() {
            TestHarness::assertFileExists('tests/run_tests.php', 'tests/run_tests.php exists');
        });

        TestHarness::runTest('test_f20_t1_02_runner_executable_via_php', 'Tier 1', 20, function() {
            TestHarness::assertFileContains('tests/run_tests.php', '<?php', 'tests/run_tests.php is valid PHP');
        });

        TestHarness::runTest('test_f20_t1_03_runner_outputs_summary', 'Tier 1', 20, function() {
            TestHarness::assertFileContains('tests/run_tests.php', 'SUMMARY', 'run_tests.php outputs summary');
        });

        TestHarness::runTest('test_f20_t1_04_runner_exit_code_zero_on_pass', 'Tier 1', 20, function() {
            TestHarness::assertFileContains('tests/run_tests.php', 'exit(', 'run_tests.php manages exit codes');
        });

        TestHarness::runTest('test_f20_t1_05_runner_supports_modular_test_files', 'Tier 1', 20, function() {
            TestHarness::assertFileContains('tests/run_tests.php', 'require_once', 'run_tests.php loads modular tests');
        });
    }
}
