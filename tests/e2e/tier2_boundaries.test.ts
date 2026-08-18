import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestServer } from '../helpers/testServer.js';

describe('Tier 2: Boundary & Corner Cases', () => {
  let server: TestServer;
  let baseUrl: string;

  const VALID_PUBKEY_1 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFXYCZLYF357M7OJDFOB4';
  const VALID_PUBKEY_2 = 'GCVJNL7P6E4J63J2R3GZ2L2M6Q5R7P3N4V8W7X2Y3Z4A5B6C7D2E3F4G';

  before(async () => {
    server = new TestServer();
    baseUrl = await server.start();
  });

  after(async () => {
    await server.stop();
  });

  // --------------------------------------------------------------------------
  // 1. Invalid Stellar Public Key Handling
  // --------------------------------------------------------------------------
  describe('1. Invalid Stellar Key Boundaries', () => {
    test('1.1: Rejects key that does not start with G', async () => {
      const res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: 'ABRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFXYCZLYF357M7OJDFOB4',
          username: 'ValidUser1'
        })
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });

    test('1.2: Rejects key shorter than 56 characters', async () => {
      const res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: 'GBRPYHIL2CI3FNQ4',
          username: 'ValidUser2'
        })
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });

    test('1.3: Rejects key containing invalid base32 characters (0, 1, 8, 9)', async () => {
      const res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: 'G0189HIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFXYCZLYF357M7OJDFOB4',
          username: 'ValidUser3'
        })
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Illegal Username Format Boundaries
  // --------------------------------------------------------------------------
  describe('2. Illegal Username Format Boundaries', () => {
    test('2.1: Rejects username under 3 characters', async () => {
      const res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: VALID_PUBKEY_1,
          username: 'ab'
        })
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });

    test('2.2: Rejects username over 15 characters', async () => {
      const res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: VALID_PUBKEY_1,
          username: 'SuperUltraLongNinjaUsername'
        })
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });

    test('2.3: Rejects username with spaces, special characters, or emojis', async () => {
      const illegalUsernames = ['User Name', 'Ninja!', 'Chef@Domain', 'Slice-Master', 'Pizza🍕Player'];

      for (const username of illegalUsernames) {
        const res = await fetch(`${baseUrl}/api/user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pubkey: VALID_PUBKEY_1,
            username
          })
        });
        assert.equal(res.status, 400, `Expected status 400 for illegal username "${username}", got ${res.status}`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Duplicate Username Uniqueness Boundaries
  // --------------------------------------------------------------------------
  describe('3. Duplicate Username Uniqueness Boundaries', () => {
    test('3.1: Rejects duplicate username for a different public key', async () => {
      // User 1 registers username "unique_chef"
      const res1 = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: VALID_PUBKEY_1,
          username: 'unique_chef'
        })
      });
      assert.equal(res1.status === 201 || res1.status === 200, true);

      // User 2 attempts to register same username "unique_chef"
      const res2 = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: VALID_PUBKEY_2,
          username: 'unique_chef'
        })
      });
      assert.equal(res2.status === 409 || res2.status === 400, true, `Expected status 409 or 400 for duplicate username, got ${res2.status}`);
      const data2 = await res2.json();
      assert.ok(data2.error);
    });

    test('3.2: Rejects duplicate username case-insensitively', async () => {
      // User 2 attempts to register "UNIQUE_CHEF"
      const res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: VALID_PUBKEY_2,
          username: 'UNIQUE_CHEF'
        })
      });
      assert.equal(res.status === 409 || res.status === 400, true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Pagination & Limit Bounds
  // --------------------------------------------------------------------------
  describe('4. Pagination & Limit Bounds', () => {
    test('4.1: Rejects limit > 100', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard?limit=150`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });

    test('4.2: Rejects limit <= 0 or page <= 0', async () => {
      const resLimitZero = await fetch(`${baseUrl}/api/leaderboard?limit=0`);
      assert.equal(resLimitZero.status, 400);

      const resPageZero = await fetch(`${baseUrl}/api/leaderboard?page=0`);
      assert.equal(resPageZero.status, 400);

      const resNegative = await fetch(`${baseUrl}/api/leaderboard?page=-1&limit=-10`);
      assert.equal(resNegative.status, 400);
    });

    test('4.3: Handles page out of bounds gracefully with empty entries', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard?page=9999&limit=20`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.entries.length, 0);
      assert.equal(data.page, 9999);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Invalid Filter Parameters (mode/timeframe)
  // --------------------------------------------------------------------------
  describe('5. Invalid Filter Parameters', () => {
    test('5.1: Rejects invalid mode parameter', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard?mode=survival`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });

    test('5.2: Rejects invalid timeframe parameter', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard?timeframe=monthly`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Non-Existent User Rank
  // --------------------------------------------------------------------------
  describe('6. Non-Existent User Rank', () => {
    test('6.1: Returns 404 for rank query of user with no submitted scores', async () => {
      const UNKNOWN_PUBKEY = 'GDTX4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L';
      const res = await fetch(`${baseUrl}/api/leaderboard/rank?pubkey=${UNKNOWN_PUBKEY}&mode=arcade`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.ok(data.error);
    });

    test('6.2: Rejects GET /api/leaderboard/rank with missing pubkey', async () => {
      const res = await fetch(`${baseUrl}/api/leaderboard/rank?mode=arcade`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error);
    });
  });
});
