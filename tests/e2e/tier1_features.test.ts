import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestServer } from '../helpers/testServer.js';

describe('Tier 1: Feature Coverage', () => {
  let server: TestServer;
  let baseUrl: string;

  // Valid 56-char Stellar ED25519 Public Keys for testing (Base32: A-Z, 2-7)
  const ALICE_PUBKEY   = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFXYCZLYF357M7OJDFOB4';
  const BOB_PUBKEY     = 'GCVJNL7P6E4J63J2R3GZ2L2M6Q5R7P3N4V7W7X2Y3Z4A5B6C7D2E3F4G';
  const CHARLIE_PUBKEY = 'GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L';
  const MAX_USER_PUBKEY = 'GD3M5V7P2Q3R4S5T2U3V4W5X6Y7Z2A3B4C5D6E7F2G3H4J5K6L2M3N4P';
  const MIN_USER_PUBKEY = 'GE7F2G3H4J5K6L7M2N3P4Q5R6S7T2U3V4W5X6Y7Z2A3B4C5D6E7F2G3H';

  before(async () => {
    server = new TestServer();
    baseUrl = await server.start();
  });

  after(async () => {
    await server.stop();
  });

  // --------------------------------------------------------------------------
  // Feature 1: User Registration (POST /api/user)
  // --------------------------------------------------------------------------
  describe('1. User Registration (POST /api/user)', () => {
    test('1.1: Register a new valid user with full metadata', async () => {
      const res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: ALICE_PUBKEY,
          username: 'Alice_Ninja',
          avatar: 'avatar_ninja.png',
          privyDid: 'did:privy:alice123'
        })
      });

      assert.equal(res.status === 201 || res.status === 200, true, `Expected status 201 or 200, got ${res.status}`);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.user.pubkey, ALICE_PUBKEY);
      assert.equal(data.user.username, 'Alice_Ninja');
      assert.equal(data.user.avatar, 'avatar_ninja.png');
      assert.equal(data.user.privyDid, 'did:privy:alice123');
      assert.ok(data.user.createdAt);
    });

    test('1.2: Register a user with minimal metadata', async () => {
      const res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: BOB_PUBKEY,
          username: 'Bob_Slicer'
        })
      });

      assert.equal(res.status === 201 || res.status === 200, true);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.user.pubkey, BOB_PUBKEY);
      assert.equal(data.user.username, 'Bob_Slicer');
      assert.ok(data.user.avatar);
    });

    test('1.3: Update user profile metadata with same username', async () => {
      const res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: ALICE_PUBKEY,
          username: 'Alice_Ninja',
          avatar: 'updated_avatar.png',
          privyDid: 'did:privy:alice_updated'
        })
      });

      assert.equal(res.status === 201 || res.status === 200, true);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.user.avatar, 'updated_avatar.png');
      assert.equal(data.user.privyDid, 'did:privy:alice_updated');
    });

    test('1.4: Register another distinct valid user', async () => {
      const res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: CHARLIE_PUBKEY,
          username: 'Charlie_Chef'
        })
      });

      assert.equal(res.status === 201 || res.status === 200, true);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.user.pubkey, CHARLIE_PUBKEY);
      assert.equal(data.user.username, 'Charlie_Chef');
    });

    test('1.5: Register user with boundary length usernames (3 chars and 15 chars)', async () => {
      // 15 chars (max bound)
      const resMax = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: MAX_USER_PUBKEY,
          username: 'User12345678901' // exactly 15 chars
        })
      });
      assert.equal(resMax.status === 201 || resMax.status === 200, true);
      const dataMax = await resMax.json();
      assert.equal(dataMax.user.username, 'User12345678901');

      // 3 chars (min bound)
      const resMin = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: MIN_USER_PUBKEY,
          username: 'Ace' // exactly 3 chars
        })
      });
      assert.equal(resMin.status === 201 || resMin.status === 200, true);
      const dataMin = await resMin.json();
      assert.equal(dataMin.user.username, 'Ace');
    });

    test('1.6: Safely handles non-string avatar and privyDid types', async () => {
      const res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: ALICE_PUBKEY,
          username: 'Alice_Ninja',
          avatar: 12345,
          privyDid: { invalid: true }
        })
      });
      assert.equal(res.status === 201 || res.status === 200, true);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(typeof data.user.avatar, 'string');
      assert.equal(typeof data.user.privyDid, 'string');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: User Profile (GET /api/user)
  // --------------------------------------------------------------------------
  describe('2. User Profile (GET /api/user)', () => {
    test('2.1: Retrieve user profile by pubkey query parameter', async () => {
      const res = await fetch(`${baseUrl}/api/user?pubkey=${ALICE_PUBKEY}`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.pubkey, ALICE_PUBKEY);
      assert.equal(data.username, 'Alice_Ninja');
      assert.equal(data.avatar, 'updated_avatar.png');
    });

    test('2.2: Retrieve user profile by username query parameter', async () => {
      const res = await fetch(`${baseUrl}/api/user?username=Bob_Slicer`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.pubkey, BOB_PUBKEY);
      assert.equal(data.username, 'Bob_Slicer');
    });

    test('2.3: Retrieve user profile with score history and ranks', async () => {
      // First submit a score for Alice
      await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: ALICE_PUBKEY,
          score: 1200,
          mode: 'arcade'
        })
      });

      const res = await fetch(`${baseUrl}/api/user?pubkey=${ALICE_PUBKEY}`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.pubkey, ALICE_PUBKEY);
      assert.ok(data.scores);
      assert.equal(data.scores.arcade, 1200);
      assert.ok(data.rank);
      assert.equal(data.rank.arcade, 1);
    });

    test('2.4: Handle case-insensitive username lookup', async () => {
      const res = await fetch(`${baseUrl}/api/user?username=alice_ninja`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.pubkey, ALICE_PUBKEY);
      assert.equal(data.username, 'Alice_Ninja');
    });

    test('2.5: Verify response headers and CORS setup', async () => {
      const res = await fetch(`${baseUrl}/api/user?pubkey=${BOB_PUBKEY}`);
      assert.equal(res.status, 200);
      const corsOrigin = res.headers.get('access-control-allow-origin');
      assert.ok(corsOrigin);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: Leaderboard (GET /api/leaderboard)
  // --------------------------------------------------------------------------
  describe('3. Leaderboard (GET /api/leaderboard)', () => {
    test('3.1: Retrieve default leaderboard (arcade, alltime, limit 20)', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.entries);
      assert.equal(Array.isArray(data.entries), true);
      assert.equal(data.page, 1);
      assert.equal(data.limit, 20);
    });

    test('3.2: Filter leaderboard by mode=classic and timeframe=weekly', async () => {
      // Submit classic score for Bob
      await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: BOB_PUBKEY,
          score: 850,
          mode: 'classic'
        })
      });

      const res = await fetch(`${baseUrl}/api/leaderboard?mode=classic&timeframe=weekly`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.entries.length >= 1, true);
      assert.equal(data.entries[0].pubkey, BOB_PUBKEY);
      assert.equal(data.entries[0].score, 850);
      assert.equal(data.entries[0].mode, 'classic');
    });

    test('3.3: Filter leaderboard by timeframe=daily', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard?mode=arcade&timeframe=daily`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.entries);
    });

    test('3.4: Test pagination with limit and page options', async () => {
      // Submit score for Charlie
      await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: CHARLIE_PUBKEY,
          score: 950,
          mode: 'arcade'
        })
      });

      const resPage1 = await fetch(`${baseUrl}/api/leaderboard?mode=arcade&timeframe=alltime&limit=1&page=1`);
      assert.equal(resPage1.status, 200);
      const dataPage1 = await resPage1.json();
      assert.equal(dataPage1.limit, 1);
      assert.equal(dataPage1.page, 1);
      assert.equal(dataPage1.entries.length, 1);
      assert.equal(dataPage1.entries[0].rank, 1);

      const resPage2 = await fetch(`${baseUrl}/api/leaderboard?mode=arcade&timeframe=alltime&limit=1&page=2`);
      assert.equal(resPage2.status, 200);
      const dataPage2 = await resPage2.json();
      assert.equal(dataPage2.limit, 1);
      assert.equal(dataPage2.page, 2);
      assert.equal(dataPage2.entries.length, 1);
      assert.equal(dataPage2.entries[0].rank, 2);
    });

    test('3.5: Verify sorting order (descending scores) and metadata structure', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard?mode=arcade&timeframe=alltime`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.total >= 2);
      assert.ok(data.totalPages >= 1);

      // Verify descending sort
      for (let i = 0; i < data.entries.length - 1; i++) {
        assert.ok(
          data.entries[i].score >= data.entries[i + 1].score,
          `Score at index ${i} (${data.entries[i].score}) should be >= score at ${i+1} (${data.entries[i+1].score})`
        );
      }
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Rank (GET /api/leaderboard/rank)
  // --------------------------------------------------------------------------
  describe('4. Rank (GET /api/leaderboard/rank)', () => {
    test('4.1: Get exact rank and percentile for top player', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard/rank?pubkey=${ALICE_PUBKEY}&mode=arcade&timeframe=alltime`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.pubkey, ALICE_PUBKEY);
      assert.equal(data.score, 1200);
      assert.equal(data.rank, 1);
      assert.ok(data.topPercentile !== null);
    });

    test('4.2: Get exact rank and percentile for mid-tier player', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard/rank?pubkey=${CHARLIE_PUBKEY}&mode=arcade&timeframe=alltime`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.pubkey, CHARLIE_PUBKEY);
      assert.equal(data.score, 950);
      assert.equal(data.rank, 2);
    });

    test('4.3: Get rank for user in classic mode', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard/rank?pubkey=${BOB_PUBKEY}&mode=classic&timeframe=alltime`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.pubkey, BOB_PUBKEY);
      assert.equal(data.score, 850);
      assert.equal(data.rank, 1);
    });

    test('4.4: Get rank across different timeframes', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard/rank?pubkey=${ALICE_PUBKEY}&mode=arcade&timeframe=weekly`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.pubkey, ALICE_PUBKEY);
      assert.equal(data.timeframe, 'weekly');
    });

    test('4.5: Verify rank calculation accuracy against total players count', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard/rank?pubkey=${ALICE_PUBKEY}&mode=arcade&timeframe=alltime`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.totalPlayers >= 2);
      const expectedPercentile = Number(((data.rank / data.totalPlayers) * 100).toFixed(2));
      assert.equal(data.topPercentile, expectedPercentile);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Score Sync (api/score.ts)
  // --------------------------------------------------------------------------
  describe('5. Score Sync (api/score.ts)', () => {
    test('5.1: POST /api/score updates high score in Redis', async () => {
      const res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: ALICE_PUBKEY,
          score: 1500,
          mode: 'arcade'
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.updated, true);

      // Verify rank updated
      const rankRes = await fetch(`${baseUrl}/api/leaderboard/rank?pubkey=${ALICE_PUBKEY}&mode=arcade`);
      const rankData = await rankRes.json();
      assert.equal(rankData.score, 1500);
    });

    test('5.2: POST /api/score with lower score does not downgrade personal best', async () => {
      // Ensure Alice is registered first
      await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: ALICE_PUBKEY, username: 'Alice_Ninja' })
      });

      // Submit high score first
      await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: ALICE_PUBKEY, score: 1500, mode: 'arcade' })
      });

      // Submit lower score
      const res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: ALICE_PUBKEY,
          score: 300,
          mode: 'arcade'
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.updated, false);

      // High score remains 1500
      const userRes = await fetch(`${baseUrl}/api/user?pubkey=${ALICE_PUBKEY}`);
      assert.equal(userRes.status, 200);
      const userData = await userRes.json();
      assert.equal(userData.scores.arcade, 1500);
    });

    test('5.3: POST /api/score with classic mode updates classic leaderboard', async () => {
      // Ensure Alice is registered first
      await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: ALICE_PUBKEY, username: 'Alice_Ninja' })
      });

      const res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: ALICE_PUBKEY,
          score: 2000,
          mode: 'classic'
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.updated, true);

      const userRes = await fetch(`${baseUrl}/api/user?pubkey=${ALICE_PUBKEY}`);
      assert.equal(userRes.status, 200);
      const userData = await userRes.json();
      assert.equal(userData.scores.classic, 2000);
    });

    test('5.4: GET /api/score returns top legacy global leaderboard entries', async () => {
      const res = await fetch(`${baseUrl}/api/score`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(Array.isArray(data), true);
    });

    test('5.5: POST /api/score generates valid transaction hash response', async () => {
      const res = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Ninja_Chef',
          pubkey: BOB_PUBKEY,
          score: 990,
          mode: 'arcade'
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.txHash);
      assert.equal(typeof data.txHash, 'string');
    });
  });
});
