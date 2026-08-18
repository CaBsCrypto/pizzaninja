import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestServer } from '../helpers/testServer.js';
import { kv } from '@vercel/kv';
import { getISOWeekString, getUTCDateString } from '../../api/score.js';

describe('Milestone 3 Empirical Verification: Score Sync & UI Integration', () => {
  let server: TestServer;
  let baseUrl: string;

  const TEST_PUBKEY = 'GAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L2';
  const TEST_PUBKEY_2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFXYCZLYF357M7OJDFOB4';

  before(async () => {
    server = new TestServer();
    baseUrl = await server.start();
  });

  after(async () => {
    await server.stop();
  });

  test('M3.1: ISO Week & Date Helper Functions match ISO standards', () => {
    const now = new Date('2026-08-10T12:00:00Z');
    const weekStr = getISOWeekString(now);
    const dateStr = getUTCDateString(now);

    assert.equal(weekStr, '2026-W33');
    assert.equal(dateStr, '2026-08-10');
  });

  test('M3.2: Score submission updates alltime, weekly, and daily Redis ZSETs and user profile', async () => {
    const client = kv as any;

    // Register user first
    const regRes = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: TEST_PUBKEY,
        username: 'Ninja_Tester',
        avatar: 'blade_master'
      })
    });
    assert.equal(regRes.status, 201, `Expected 201, got ${regRes.status}`);

    // Submit Arcade score 5000
    const scoreRes = await fetch(`${baseUrl}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: TEST_PUBKEY,
        score: 5000,
        mode: 'arcade'
      })
    });

    assert.equal(scoreRes.status, 200);
    const scoreData = await scoreRes.json();
    assert.equal(scoreData.success, true);
    assert.equal(scoreData.updated, true);
    assert.equal(scoreData.score, 5000);
    assert.equal(scoreData.mode, 'arcade');
    assert.equal(typeof scoreData.rank, 'number');
    assert.ok(scoreData.txHash);

    const isoWeek = getISOWeekString();
    const isoDate = getUTCDateString();

    // Verify Redis All-Time ZSET
    const alltimeScore = await client.zscore(`slashslice:leaderboard:arcade:alltime`, TEST_PUBKEY);
    assert.equal(Number(alltimeScore), 5000);

    // Verify Redis Weekly ZSET
    const weeklyScore = await client.zscore(`slashslice:leaderboard:arcade:weekly:${isoWeek}`, TEST_PUBKEY);
    assert.equal(Number(weeklyScore), 5000);

    // Verify Redis Daily ZSET
    const dailyScore = await client.zscore(`slashslice:leaderboard:arcade:daily:${isoDate}`, TEST_PUBKEY);
    assert.equal(Number(dailyScore), 5000);

    // Verify Redis User Scores Tracking ZSET
    const userModeScore = await client.zscore(`slashslice:scores:${TEST_PUBKEY}`, 'arcade');
    assert.equal(Number(userModeScore), 5000);

    // Verify User Profile arcadeScore updated
    const userRes = await fetch(`${baseUrl}/api/user?pubkey=${TEST_PUBKEY}`);
    const userData = await userRes.json();
    assert.equal(userData.scores.arcade, 5000);
  });

  test('M3.3: Higher score submission updates all ZSETs, while lower score preserves high score', async () => {
    const client = kv as any;
    const isoWeek = getISOWeekString();
    const isoDate = getUTCDateString();

    // Submit higher score 8000
    const highRes = await fetch(`${baseUrl}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: TEST_PUBKEY,
        score: 8000,
        mode: 'arcade'
      })
    });

    const highData = await highRes.json();
    assert.equal(highData.success, true);
    assert.equal(highData.updated, true);

    const alltime8k = await client.zscore(`slashslice:leaderboard:arcade:alltime`, TEST_PUBKEY);
    assert.equal(Number(alltime8k), 8000);

    // Submit lower score 3000
    const lowRes = await fetch(`${baseUrl}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: TEST_PUBKEY,
        score: 3000,
        mode: 'arcade'
      })
    });

    const lowData = await lowRes.json();
    assert.equal(lowData.success, true);
    assert.equal(lowData.updated, false);

    // High scores must be preserved at 8000
    const alltimePreserved = await client.zscore(`slashslice:leaderboard:arcade:alltime`, TEST_PUBKEY);
    assert.equal(Number(alltimePreserved), 8000);

    const weeklyPreserved = await client.zscore(`slashslice:leaderboard:arcade:weekly:${isoWeek}`, TEST_PUBKEY);
    assert.equal(Number(weeklyPreserved), 8000);

    const dailyPreserved = await client.zscore(`slashslice:leaderboard:arcade:daily:${isoDate}`, TEST_PUBKEY);
    assert.equal(Number(dailyPreserved), 8000);
  });

  test('M3.4: Classic mode scores sync independently from Arcade mode', async () => {
    const client = kv as any;
    const isoWeek = getISOWeekString();
    const isoDate = getUTCDateString();

    // Submit Classic score 6500
    const classicRes = await fetch(`${baseUrl}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: TEST_PUBKEY,
        score: 6500,
        mode: 'classic'
      })
    });

    const classicData = await classicRes.json();
    assert.equal(classicData.success, true);
    assert.equal(classicData.updated, true);
    assert.equal(classicData.mode, 'classic');

    // Verify Classic ZSETs
    const classicAlltime = await client.zscore(`slashslice:leaderboard:classic:alltime`, TEST_PUBKEY);
    assert.equal(Number(classicAlltime), 6500);

    const classicWeekly = await client.zscore(`slashslice:leaderboard:classic:weekly:${isoWeek}`, TEST_PUBKEY);
    assert.equal(Number(classicWeekly), 6500);

    const classicDaily = await client.zscore(`slashslice:leaderboard:classic:daily:${isoDate}`, TEST_PUBKEY);
    assert.equal(Number(classicDaily), 6500);

    // Arcade score should remain 8000
    const arcadeAlltime = await client.zscore(`slashslice:leaderboard:arcade:alltime`, TEST_PUBKEY);
    assert.equal(Number(arcadeAlltime), 8000);

    // Profile check
    const userRes = await fetch(`${baseUrl}/api/user?pubkey=${TEST_PUBKEY}`);
    const userData = await userRes.json();
    assert.equal(userData.scores ? userData.scores.arcade : userData.stats.arcadeScore, 8000);
    assert.equal(userData.scores ? userData.scores.classic : userData.stats.classicScore, 6500);
  });

  test('M3.5: Anonymous / Name-only score submissions update ZSETs correctly', async () => {
    const client = kv as any;
    const isoWeek = getISOWeekString();
    const isoDate = getUTCDateString();

    const anonRes = await fetch(`${baseUrl}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'GuestSlicer',
        score: 4200,
        mode: 'arcade'
      })
    });

    const anonData = await anonRes.json();
    assert.equal(anonData.success, true);
    assert.equal(anonData.updated, true);

    const anonScore = await client.zscore(`slashslice:leaderboard:arcade:alltime`, 'GuestSlicer');
    assert.equal(Number(anonScore), 4200);

    const anonWeekly = await client.zscore(`slashslice:leaderboard:arcade:weekly:${isoWeek}`, 'GuestSlicer');
    assert.equal(Number(anonWeekly), 4200);

    const anonDaily = await client.zscore(`slashslice:leaderboard:arcade:daily:${isoDate}`, 'GuestSlicer');
    assert.equal(Number(anonDaily), 4200);
  });
});
