import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestServer } from './helpers/testServer.js';
import { getISOWeekString, getUTCDateString } from '../api/score.js';

describe('Adversarial M3 Stress & Challenge Verification Harness', () => {
  let server: TestServer;
  let baseUrl: string;

  // Helper to generate guaranteed valid 56-character Stellar Ed25519 public keys matching /^G[A-Z2-7]{55}$/
  // Base32 strictly uses A-Z and digits 2-7 (NO 0, 1, 8, 9)
  const makePubkey = (tag: string) => ('G' + tag.toUpperCase().replace(/[^A-Z2-7]/g, 'A') + 'A'.repeat(55)).slice(0, 56);

  const PUBKEY_ADV_1 = makePubkey('ADVA');
  const PUBKEY_ADV_2 = makePubkey('ADVB');
  const PUBKEY_ADV_3 = makePubkey('ADVC');
  const PUBKEY_NEG   = makePubkey('NEGA');
  const CONCURRENT_PUBKEY = makePubkey('CONC');
  const UNREG_PUBKEY = makePubkey('UNRG');

  before(async () => {
    server = new TestServer();
    baseUrl = await server.start();
  });

  after(async () => {
    await server.stop();
  });

  describe('1. ISO Week & UTC Date Boundary Helper Unit Tests', () => {
    test('1.1 ISO Week calculation for boundary dates across years', () => {
      // 2026-01-01 (Thursday) is in 2026-W01
      const jan1_2026 = new Date(Date.UTC(2026, 0, 1));
      assert.equal(getISOWeekString(jan1_2026), '2026-W01');

      // 2024-12-30 (Monday) is in 2025-W01
      const dec30_2024 = new Date(Date.UTC(2024, 11, 30));
      assert.equal(getISOWeekString(dec30_2024), '2025-W01');

      // 2021-01-01 (Friday) is in 2020-W53
      const jan1_2021 = new Date(Date.UTC(2021, 0, 1));
      assert.equal(getISOWeekString(jan1_2021), '2020-W53');
    });

    test('1.2 UTC Date String formatting padding check', () => {
      const jan5_2026 = new Date(Date.UTC(2026, 0, 5));
      assert.equal(getUTCDateString(jan5_2026), '2026-01-05');

      const dec31_2026 = new Date(Date.UTC(2026, 11, 31));
      assert.equal(getUTCDateString(dec31_2026), '2026-12-31');
    });
  });

  describe('2. User Registration Score Backfilling & Preservation Stress Tests', () => {
    test('2.1 Unregistered user scores backfilled into profile upon registration', async () => {
      // 1. Submit Arcade score 1250 before profile registration
      let scoreRes = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 1250, pubkey: PUBKEY_ADV_1, mode: 'arcade' })
      });
      assert.equal(scoreRes.status, 200);

      // 2. Submit Classic score 980 before profile registration
      scoreRes = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 980, pubkey: PUBKEY_ADV_1, mode: 'classic' })
      });
      assert.equal(scoreRes.status, 200);

      // 3. Register user profile
      const regRes = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: PUBKEY_ADV_1,
          username: 'PreRegHero',
          avatar: 'blade_master',
          privyDid: 'did:privy:prereghero123'
        })
      });
      assert.equal(regRes.status, 201);
      const regData = await regRes.json();
      assert.equal(regData.success, true);
      assert.equal(regData.user.arcadeScore, 1250, 'Arcade score must be backfilled into registered user object');
      assert.equal(regData.user.classicScore, 980, 'Classic score must be backfilled into registered user object');

      // 4. Verify GET /api/user returns backfilled scores in both user profile and stats
      const userRes = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_ADV_1}`);
      assert.equal(userRes.status, 200);
      const userData = await userRes.json();
      assert.equal(userData.user.arcadeScore, 1250);
      assert.equal(userData.user.classicScore, 980);
      assert.equal(userData.stats.arcadeScore, 1250);
      assert.equal(userData.stats.classicScore, 980);
    });

    test('2.2 Updating profile metadata (avatar/username) preserves high scores', async () => {
      // Update username to 'UpdatedHero' and avatar to 'chef_pizza'
      const updateRes = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: PUBKEY_ADV_1,
          username: 'UpdatedHero',
          avatar: 'chef_pizza'
        })
      });
      assert.equal(updateRes.status, 201);
      const updateData = await updateRes.json();
      assert.equal(updateData.user.username, 'UpdatedHero');
      assert.equal(updateData.user.avatar, 'chef_pizza');
      assert.equal(updateData.user.arcadeScore, 1250, 'Arcade high score preserved on profile update');
      assert.equal(updateData.user.classicScore, 980, 'Classic high score preserved on profile update');
    });

    test('2.3 Case-insensitive username update and lookup', async () => {
      // Attempt to register another user with existing username in different case 'updatedhero'
      const dupRes = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: PUBKEY_ADV_2,
          username: 'UPDATEDHERO'
        })
      });
      assert.equal(dupRes.status, 409);
      const dupData = await dupRes.json();
      assert.equal(dupData.success, false);
      assert.match(dupData.error, /already taken/i);

      // GET user by username with lowercase 'updatedhero'
      const getByUsernameRes = await fetch(`${baseUrl}/api/user?username=updatedhero`);
      assert.equal(getByUsernameRes.status, 200);
      const getByUsernameData = await getByUsernameRes.json();
      assert.equal(getByUsernameData.user.pubkey, PUBKEY_ADV_1);
    });

    test('2.4 Negative score backfill check on POST /api/user', async () => {
      // Unregistered user submits negative score -50
      const scoreRes = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: -50, pubkey: PUBKEY_NEG, mode: 'arcade' })
      });
      assert.equal(scoreRes.status, 200);

      // Register profile for PUBKEY_NEG
      const regRes = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: PUBKEY_NEG, username: 'NegativeUser' })
      });
      assert.equal(regRes.status, 201);
      const regData = await regRes.json();

      // Fetch user profile
      const userRes = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_NEG}`);
      const userData = await userRes.json();

      // Note: arcadeScore in stats comes from ZSET (-50), while user profile hash backfill uses Math.max(0, zset) = 0
      assert.equal(userData.stats.arcadeScore, -50, 'ZSET retains negative score -50');
      assert.equal(regData.user.arcadeScore, 0, 'Default backfill Math.max(0, -50) resolves to 0');
    });
  });

  describe('3. Multi-Period Leaderboard Sync & Non-Downgrade Stress Tests', () => {
    test('3.1 Mode Isolation: Arcade score does not overwrite Classic score in ZSETs or profile', async () => {
      // Register PUBKEY_ADV_2
      await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: PUBKEY_ADV_2, username: 'ModeIsoUser' })
      });

      // Submit Classic score = 3000
      await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 3000, pubkey: PUBKEY_ADV_2, mode: 'classic' })
      });

      // Submit Arcade score = 1500
      await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 1500, pubkey: PUBKEY_ADV_2, mode: 'arcade' })
      });

      // Fetch user profile stats
      const userRes = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_ADV_2}`);
      const userData = await userRes.json();
      assert.equal(userData.stats.classicScore, 3000, 'Classic score must remain 3000');
      assert.equal(userData.stats.arcadeScore, 1500, 'Arcade score must be 1500');

      // Fetch Arcade leaderboard
      const arcadeLbRes = await fetch(`${baseUrl}/api/leaderboard?mode=arcade`);
      const arcadeLbData = await arcadeLbRes.json();
      const arcadeEntry = arcadeLbData.players.find((p: any) => p.pubkey === PUBKEY_ADV_2 || p.member === PUBKEY_ADV_2);
      assert.equal(arcadeEntry.score, 1500);

      // Fetch Classic leaderboard
      const classicLbRes = await fetch(`${baseUrl}/api/leaderboard?mode=classic`);
      const classicLbData = await classicLbRes.json();
      const classicEntry = classicLbData.players.find((p: any) => p.pubkey === PUBKEY_ADV_2 || p.member === PUBKEY_ADV_2);
      assert.equal(classicEntry.score, 3000);
    });

    test('3.2 Non-downgrade logic under high score progression and lower score attempts', async () => {
      // Register PUBKEY_ADV_3
      await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: PUBKEY_ADV_3, username: 'ProgressionUser' })
      });

      const scoreSequence = [100, 250, 200, 500, 450, 500, 600, 0, 100];
      const expectedUpdates = [true, true, false, true, false, false, true, false, false];
      const expectedBests = [100, 250, 250, 500, 500, 500, 600, 600, 600];

      for (let i = 0; i < scoreSequence.length; i++) {
        const score = scoreSequence[i];
        const res = await fetch(`${baseUrl}/api/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score, pubkey: PUBKEY_ADV_3, mode: 'arcade' })
        });
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.updated, expectedUpdates[i], `Sequence index ${i}: score=${score} updated status expected ${expectedUpdates[i]}`);

        const userRes = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_ADV_3}`);
        const userData = await userRes.json();
        assert.equal(userData.stats.arcadeScore, expectedBests[i], `Sequence index ${i}: expected personal best ${expectedBests[i]}`);
      }
    });
  });

  describe('4. Race Condition & Concurrency Analysis', () => {
    test('4.1 Sequential vs Parallel score submissions convergence', async () => {
      await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: CONCURRENT_PUBKEY, username: 'ConcurrentNinja' })
      });

      // Submit initial high score 2400
      await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 2400, pubkey: CONCURRENT_PUBKEY, mode: 'arcade' })
      });

      // Concurrently submit multiple lower scores
      const lowerScores = [50, 200, 800, 120, 500, 350, 1500, 90, 2200];
      await Promise.all(
        lowerScores.map(s =>
          fetch(`${baseUrl}/api/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: s, pubkey: CONCURRENT_PUBKEY, mode: 'arcade' })
          })
        )
      );

      const userRes = await fetch(`${baseUrl}/api/user?pubkey=${CONCURRENT_PUBKEY}`);
      const userData = await userRes.json();
      assert.equal(userData.stats.arcadeScore, 2400, 'All-time high score 2400 must be preserved despite lower concurrent submissions');
    });
  });

  describe('5. StellarHub UI Contract Compliance Verification', () => {
    test('5.1 Verify response format matches StellarHub expected UserProfile & UserStats types', async () => {
      const res = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_ADV_1}`);
      const data = await res.json();

      assert.equal(res.status, 200);
      assert.equal(data.success, true);
      assert.ok(data.user, 'data.user object must exist');
      assert.equal(typeof data.user.pubkey, 'string');
      assert.equal(typeof data.user.username, 'string');
      assert.ok(data.stats, 'data.stats object must exist');
      assert.equal(typeof data.stats.arcadeScore, 'number');
      assert.equal(typeof data.stats.classicScore, 'number');
    });

    test('5.2 Verify 404 response for unregistered wallet pubkey', async () => {
      const res = await fetch(`${baseUrl}/api/user?pubkey=${UNREG_PUBKEY}`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.error, 'User not found');
    });
  });
});
