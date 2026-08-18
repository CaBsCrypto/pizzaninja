# Test Infrastructure & Architecture — SpicyCrust Game Ecosystem API

## 1. Overview
The SpicyCrust Game Ecosystem API test suite is an opaque-box, requirement-driven automated testing framework built in PHP CLI. It verifies all 20 system features across 4 comprehensive testing tiers without relying on internal implementation details.

## 2. Test Architecture
- **Test Runner (`tests/run_tests.php`)**: Standard PHP CLI executable that auto-discovers test suites in `tests/`, executes test cases, aggregates results, and reports pass/fail statistics with exit code `0` on success and `1` on failure.
- **Test Harness (`tests/TestHarness.php`)**: Core testing utility providing assertions, HTTP request dispatching (supporting live HTTP endpoints via cURL/streams and in-process HTTP dispatch simulation), file & schema integrity inspection, environment mock validation, and output formatting.
- **Modular Test Files (`tests/Tier*_*.php`)**:
  - `tests/Tier1_FeatureCoverageTest.php`: Feature coverage (happy path & basic inputs).
  - `tests/Tier2_BoundaryCornerCasesTest.php`: Boundary, corner cases, error envelopes, and invalid inputs.
  - `tests/Tier3_CrossFeatureCombinationsTest.php`: Multi-feature pairwise interactions.
  - `tests/Tier4_RealWorldScenariosTest.php`: End-to-end multi-game ecosystem workload simulations.

## 3. Feature Coverage Matrix (20 Features across 4 Tiers)

| Feature # | Feature Name | Tier 1 Tests | Tier 2 Tests | Tier 3 Scenarios | Tier 4 Scenarios | Total Tests |
|-----------|--------------|--------------|--------------|------------------|------------------|-------------|
| 1 | Health Check API (`GET /api/v1/health`) | 5 | 5 | T3_13 | T4_07, T4_10 | 12 |
| 2 | DB Schema DDL (`database/schema.sql`) | 5 | 5 | - | T4_09, T4_10 | 12 |
| 3 | DB Seeding (`database/seed.sql`) | 5 | 5 | - | T4_09, T4_10 | 12 |
| 4 | PDO DB Connection (`Connection.php`) | 5 | 5 | T3_13 | T4_09 | 12 |
| 5 | Environment Config (`.env.example`) | 5 | 5 | - | T4_09 | 11 |
| 6 | Router & Base Pipeline (`Router.php`, `index.php`) | 5 | 5 | T3_07, T3_15 | T4_10 | 13 |
| 7 | Standard Error Envelopes | 5 | 5 | T3_06, T3_07 | T4_05, T4_10 | 13 |
| 8 | Bearer Token Auth (`AuthMiddleware.php`) | 5 | 5 | T3_01, T3_03, T3_06, T3_11 | T4_05, T4_10 | 16 |
| 9 | CORS Origin Control (`CorsMiddleware.php`) | 5 | 5 | T3_03, T3_07 | T4_06 | 13 |
| 10 | Rate Limiting Middleware (`RateLimitMiddleware.php`) | 5 | 5 | T3_04, T3_12 | T4_05 | 13 |
| 11 | Payload Validation & Sanitization (`Validator.php`) | 5 | 5 | T3_05, T3_07 | T4_05 | 13 |
| 12 | Score Submission API (`POST /api/v1/scores`) | 5 | 5 | T3_01, T3_02, T3_04, T3_08 | T4_01, T4_02, T4_03, T4_08, T4_10 | 19 |
| 13 | Per-Game Leaderboard API (`GET /api/v1/leaderboard`) | 5 | 5 | T3_01, T3_02, T3_05, T3_10, T3_14 | T4_01, T4_03, T4_04, T4_08, T4_10 | 20 |
| 14 | Global Leaderboard API (`GET /api/v1/leaderboard/global`) | 5 | 5 | T3_08 | T4_01, T4_08, T4_10 | 13 |
| 15 | Seasons API (`GET /api/v1/seasons`, `/current`) | 5 | 5 | T3_02, T3_09 | T4_01, T4_04, T4_10 | 13 |
| 16 | System Documentation (`README.md`) | 5 | 5 | - | - | 10 |
| 17 | API Documentation (`docs/API.md`) | 5 | 5 | T3_15 | - | 11 |
| 18 | Security Documentation (`docs/SECURITY.md`) | 5 | 5 | - | T4_05 | 11 |
| 19 | Architecture Documentation (`docs/ARCHITECTURE.md`) | 5 | 5 | - | - | 10 |
| 20 | E2E Test Suite (`tests/run_tests.php`) | 5 | 5 | - | T4_10 | 11 |
| **TOTAL** | **20 Features** | **100** | **100** | **15** | **10** | **225** |

## 4. Testing Tiers & Methodology

### Tier 1: Feature Coverage (100 Tests)
- Verifies happy paths, valid HTTP responses, schema definitions, documentation files, router matching, and default outputs.
- Requires 5 dedicated tests per feature.

### Tier 2: Boundary & Corner Cases (100 Tests)
- Verifies malformed JSON, missing authorization headers, invalid data types, rate limits, SQL injection protection, XSS escaping, CORS headers, extreme numeric bounds, non-existent slugs, and error envelope compliance.
- Requires 5 dedicated tests per feature.

### Tier 3: Cross-Feature Combinations (15 Scenarios)
- Evaluates pairwise interactions between core subsystems:
  - Authentication + Score Submission + Leaderboard Updating
  - Score Submission + Season Filtering
  - CORS Preflight + Bearer Token Auth + JSON Validation
  - Rate Limiting + Auth Error Handling
  - SQL Injection Payloads + Prepared Statement Routing
  - Multi-Game Score Submissions + Global Leaderboard Aggregation

### Tier 4: Real-World Application Scenarios (10 Scenarios)
- Simulates complete multi-game ecosystem workloads:
  - Multi-game arcade tournament across 3 games and 5 players
  - Brand new player onboarding & instantaneous leaderboard ranking
  - High-frequency arcade cabinet score posting and ranking updates
  - Seasonal transition with past season archiving
  - Malicious attack simulation (SQLi, XSS, rate-limit flooding, bad auth)
  - Full end-to-end ecosystem lifecycle (health -> seasons -> scores -> leaderboards -> error envelope verification)

## 5. Execution Instructions
```bash
# Run full E2E test suite
php tests/run_tests.php

# Filter by tier
php tests/run_tests.php --tier=1
php tests/run_tests.php --tier=2
php tests/run_tests.php --tier=3
php tests/run_tests.php --tier=4

# Filter by test name
php tests/run_tests.php --filter=health

# Specify target server URL
php tests/run_tests.php --url=http://127.0.0.1:8000
```
