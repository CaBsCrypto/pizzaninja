import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestServer } from '../helpers/testServer.js';

describe('Tier 3: Cross-Feature Interactions', () => {
  let server: TestServer;
  let baseUrl: string;

  const USER_PUBKEY = 'GDRP4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L';

  before(async () => {
    server = new TestServer();
    baseUrl = await server.start();
  });

  after(async () => {
    await server.stop();
  });

  test('Tier 3 Workflow: Register -> Post Score -> Check Rank & Percentile -> Update Profile -> Retrieve Profile', async () => {
    // Step 1: Register User
    const regRes = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: USER_PUBKEY,
        username: 'FlowMaster',
        avatar: 'initial_flow.png',
        privyDid: 'did:privy:flow1'
      })
    });
    assert.equal(regRes.status === 201 || regRes.status === 200, true);
    const regData = await regRes.json();
    assert.equal(regData.success, true);
    assert.equal(regData.user.username, 'FlowMaster');

    // Step 2: Post Initial Score
    const scoreRes1 = await fetch(`${baseUrl}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: USER_PUBKEY,
        name: 'FlowMaster',
        score: 2500,
        mode: 'arcade'
      })
    });
    assert.equal(scoreRes1.status, 200);
    const scoreData1 = await scoreRes1.json();
    assert.equal(scoreData1.success, true);
    assert.equal(scoreData1.updated, true);

    // Step 3: Check Leaderboard Rank & Percentile
    const rankRes = await fetch(`${baseUrl}/api/leaderboard/rank?pubkey=${USER_PUBKEY}&mode=arcade&timeframe=alltime`);
    assert.equal(rankRes.status, 200);
    const rankData = await rankRes.json();
    assert.equal(rankData.pubkey, USER_PUBKEY);
    assert.equal(rankData.score, 2500);
    assert.equal(rankData.rank, 1);
    assert.equal(rankData.topPercentile, 100);

    // Step 4: Verify User Appears in Global Leaderboard GET /api/leaderboard
    const lbRes = await fetch(`${baseUrl}/api/leaderboard?mode=arcade&timeframe=alltime`);
    assert.equal(lbRes.status, 200);
    const lbData = await lbRes.json();
    assert.equal(lbData.entries.length >= 1, true);
    const userEntry = lbData.entries.find((e: any) => e.pubkey === USER_PUBKEY);
    assert.ok(userEntry);
    assert.equal(userEntry.username, 'FlowMaster');
    assert.equal(userEntry.score, 2500);

    // Step 5: Update Profile Metadata
    const updateRes = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: USER_PUBKEY,
        username: 'FlowMaster',
        avatar: 'updated_flow_master.png',
        privyDid: 'did:privy:flow_updated'
      })
    });
    assert.equal(updateRes.status === 201 || updateRes.status === 200, true);
    const updateData = await updateRes.json();
    assert.equal(updateData.user.avatar, 'updated_flow_master.png');

    // Step 6: Post Higher Score
    const scoreRes2 = await fetch(`${baseUrl}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: USER_PUBKEY,
        name: 'FlowMaster',
        score: 4200,
        mode: 'arcade'
      })
    });
    assert.equal(scoreRes2.status, 200);

    // Step 7: Final Profile Inspection via GET /api/user
    const getRes = await fetch(`${baseUrl}/api/user?pubkey=${USER_PUBKEY}`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.pubkey, USER_PUBKEY);
    assert.equal(getData.username, 'FlowMaster');
    assert.equal(getData.avatar, 'updated_flow_master.png');
    assert.equal(getData.scores.arcade, 4200);
    assert.equal(getData.rank.arcade, 1);
  });
});
