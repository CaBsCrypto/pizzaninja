<?php
/**
 * run_tests.php
 * Automated HTTP E2E Test Runner for SpicyCrust Game Ecosystem API.
 * 
 * Usage:
 *   php tests/run_tests.php [--tier=1|2|3|4] [--filter=pattern] [--url=http://127.0.0.1:8000] [--verbose]
 */

namespace SpicyCrust\Tests;

require_once __DIR__ . '/TestHarness.php';
require_once __DIR__ . '/Tier1_FeatureCoverageTest.php';
require_once __DIR__ . '/Tier2_BoundaryCornerCasesTest.php';
require_once __DIR__ . '/Tier3_CrossFeatureCombinationsTest.php';
require_once __DIR__ . '/Tier4_RealWorldScenariosTest.php';

// Parse command line arguments
$options = getopt('', ['tier:', 'filter:', 'url:', 'verbose']);

$tier = $options['tier'] ?? null;
$filter = $options['filter'] ?? null;
$url = $options['url'] ?? null;
$verbose = isset($options['verbose']);

echo "======================================================\n";
echo "   SPICYCRUST GAME API E2E AUTOMATED TEST RUNNER      \n";
echo "======================================================\n";
if ($tier) echo "Tier Filter : Tier {$tier}\n";
if ($filter) echo "Name Filter : {$filter}\n";
if ($url) echo "Target URL  : {$url}\n";
echo "------------------------------------------------------\n";

TestHarness::init($url, $filter, $tier ? "Tier {$tier}" : null, $verbose);

$startTime = microtime(true);

if ($tier === null || $tier == '1') {
    Tier1_FeatureCoverageTest::run();
}
if ($tier === null || $tier == '2') {
    Tier2_BoundaryCornerCasesTest::run();
}
if ($tier === null || $tier == '3') {
    Tier3_CrossFeatureCombinationsTest::run();
}
if ($tier === null || $tier == '4') {
    Tier4_RealWorldScenariosTest::run();
}

$duration = round(microtime(true) - $startTime, 3);
echo "\nTotal Test Suite Execution Time: {$duration} seconds.\n";

$exitCode = TestHarness::printSummary();
exit($exitCode);
