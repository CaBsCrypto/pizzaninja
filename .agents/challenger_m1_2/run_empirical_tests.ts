import { TestServer } from '../../tests/helpers/testServer.js';
import assert from 'node:assert/strict';

async function runTests() {
  console.log('===============================================================');
  console.log('EMPIRICAL STRESS TEST SUITE FOR api/user.ts (CHALLENGER 2)');
  console.log('===============================================================\n');

  const server = new TestServer({ useRealHandlersIfAvailable: true });
  const baseUrl = await server.start();
  console.log(`[Setup] Test server active at: ${baseUrl}\n`);

  const client = server.mockKv.store;

  // Valid Stellar Public Keys (56 chars, Base32: A-Z, 2-7)
  const PUBKEY_A = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFXYCZLYF357M7OJDFOB4';
  const PUBKEY_B = 'GCVJNL7P6E4J63J2R3GZ2L2M6Q5R7P3N4V7W7X2Y3Z4A5B6C7D2E3F4G';
  const PUBKEY_C = 'GAAK4V7K2M3N4P5Q2R3S4T5U6V7W2X3Y4Z5A2B3C4D5E6F7G2H3J4K5L';

  const results: Array<{ id: string; category: string; description: string; status: 'PASS' | 'FAIL'; error?: string }> = [];

  async function recordTest(id: string, category: string, description: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ id, category, description, status: 'PASS' });
      console.log(`[PASS] ${id} - ${description}`);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      results.push({ id, category, description, status: 'FAIL', error: errMsg });
      console.log(`[FAIL] ${id} - ${description}`);
      console.log(`       Reason: ${errMsg}`);
    }
  }

  // --------------------------------------------------------------------------
  // Category 1: Case Sensitivity Edge Cases
  // --------------------------------------------------------------------------
  console.log('--- Category 1: Case Sensitivity Edge Cases ---');

  await recordTest('CS-1', 'Case Sensitivity', 'Register new user "User_One" for PUBKEY_A', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: PUBKEY_A, username: 'User_One' })
    });
    assert.equal(res.status, 200, `HTTP status should be 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.user.username, 'User_One');

    const indexOwner = client.get('slashslice:username:user_one');
    // Note: client.set serialized the string as JSON or string
    const rawVal = typeof indexOwner === 'string' && indexOwner.startsWith('"') ? JSON.parse(indexOwner) : indexOwner;
    assert.equal(rawVal, PUBKEY_A, 'slashslice:username:user_one should resolve to PUBKEY_A');
  });

  await recordTest('CS-2', 'Case Sensitivity', 'Prevent PUBKEY_B from registering lowercase "user_one" when "User_One" exists', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: PUBKEY_B, username: 'user_one' })
    });
    assert.equal(res.status, 409, `Expected HTTP 409 Conflict for duplicate normalized username, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'Username already taken');
  });

  await recordTest('CS-3', 'Case Sensitivity', 'Prevent PUBKEY_B from registering uppercase "USER_ONE" when "User_One" exists', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: PUBKEY_B, username: 'USER_ONE' })
    });
    assert.equal(res.status, 409, `Expected HTTP 409 Conflict, got ${res.status}`);
  });

  await recordTest('CS-4', 'Case Sensitivity', 'Prevent PUBKEY_B from registering mixed-case "uSeR_oNe" when "User_One" exists', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: PUBKEY_B, username: 'uSeR_oNe' })
    });
    assert.equal(res.status, 409, `Expected HTTP 409 Conflict, got ${res.status}`);
  });

  await recordTest('CS-5', 'Case Sensitivity', 'Allow owner PUBKEY_A to update username casing to "USER_ONE"', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: PUBKEY_A, username: 'USER_ONE' })
    });
    assert.equal(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.user.username, 'USER_ONE');
  });

  await recordTest('CS-6', 'Case Sensitivity', 'Clean up old username index when owner PUBKEY_A changes username to "New_Name"', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: PUBKEY_A, username: 'New_Name' })
    });
    assert.equal(res.status, 200);
    
    // Old index should be deleted
    const oldIndex = client.get('slashslice:username:user_one');
    assert.equal(oldIndex, null, 'Old username index slashslice:username:user_one must be deleted');

    // New index should point to PUBKEY_A
    const newIndex = client.get('slashslice:username:new_name');
    const rawVal = typeof newIndex === 'string' && newIndex.startsWith('"') ? JSON.parse(newIndex) : newIndex;
    assert.equal(rawVal, PUBKEY_A);
  });

  await recordTest('CS-7', 'Case Sensitivity', 'Allow PUBKEY_B to claim released username "user_one"', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: PUBKEY_B, username: 'user_one' })
    });
    assert.equal(res.status, 200, `Expected HTTP 200, got ${res.status}`);
  });

  // --------------------------------------------------------------------------
  // Category 2: Profile Lookup by Username vs Pubkey
  // --------------------------------------------------------------------------
  console.log('\n--- Category 2: Profile Lookup by Username vs Pubkey ---');

  await recordTest('PL-1', 'Profile Lookup', 'GET /api/user by pubkey (PUBKEY_A)', async () => {
    const res = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_A}`);
    assert.equal(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.user.pubkey, PUBKEY_A);
  });

  await recordTest('PL-2', 'Profile Lookup', 'GET /api/user by exact username ("New_Name")', async () => {
    const res = await fetch(`${baseUrl}/api/user?username=New_Name`);
    assert.equal(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.user.pubkey, PUBKEY_A);
  });

  await recordTest('PL-3', 'Profile Lookup', 'GET /api/user by lowercase username ("new_name")', async () => {
    const res = await fetch(`${baseUrl}/api/user?username=new_name`);
    assert.equal(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.user.pubkey, PUBKEY_A);
  });

  await recordTest('PL-4', 'Profile Lookup', 'GET /api/user by uppercase username ("NEW_NAME")', async () => {
    const res = await fetch(`${baseUrl}/api/user?username=NEW_NAME`);
    assert.equal(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.user.pubkey, PUBKEY_A);
  });

  await recordTest('PL-5', 'Profile Lookup', 'GET /api/user with both pubkey and username parameters', async () => {
    const res = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_A}&username=user_one`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.pubkey, PUBKEY_A);
  });

  await recordTest('PL-6', 'Profile Lookup', 'GET /api/user for non-existent pubkey returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/user?pubkey=${PUBKEY_C}`);
    assert.equal(res.status, 404, `Expected HTTP 404 for unregistered pubkey, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'User not found');
  });

  await recordTest('PL-7', 'Profile Lookup', 'GET /api/user for non-existent username returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/user?username=Ghost_User`);
    assert.equal(res.status, 404, `Expected HTTP 404 for unregistered username, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'User not found');
  });

  await recordTest('PL-8', 'Profile Lookup', 'GET /api/user with malformed pubkey returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/user?pubkey=INVALID_KEY`);
    assert.equal(res.status, 400, `Expected HTTP 400 for invalid pubkey, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  await recordTest('PL-9', 'Profile Lookup', 'GET /api/user with malformed username returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/user?username=a`);
    assert.equal(res.status, 400, `Expected HTTP 400 for invalid username, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  // --------------------------------------------------------------------------
  // Category 3: Privy DID Lookup Integration
  // --------------------------------------------------------------------------
  console.log('\n--- Category 3: Privy DID Lookup Integration ---');

  const DID_1 = 'did:privy:clp2u2k2c000kmt08y8r7u03q';
  const DID_2 = 'did:privy:updated_did_999';

  await recordTest('PD-1', 'Privy DID', 'POST /api/user creates slashslice:privy:<privyDid> index in Redis', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: PUBKEY_C, username: 'Charlie_Privy', privyDid: DID_1 })
    });
    assert.equal(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.user.privyDid, DID_1);

    const indexVal = client.get(`slashslice:privy:${DID_1}`);
    const rawVal = typeof indexVal === 'string' && indexVal.startsWith('"') ? JSON.parse(indexVal) : indexVal;
    assert.equal(rawVal, PUBKEY_C, `Redis key slashslice:privy:${DID_1} should point to PUBKEY_C`);
  });

  await recordTest('PD-2', 'Privy DID', 'Updating privyDid deletes old slashslice:privy:<oldPrivyDid> index', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: PUBKEY_C, username: 'Charlie_Privy', privyDid: DID_2 })
    });
    assert.equal(res.status, 200);

    const oldIndex = client.get(`slashslice:privy:${DID_1}`);
    assert.equal(oldIndex, null, `Old Privy DID index slashslice:privy:${DID_1} should be deleted`);

    const newIndex = client.get(`slashslice:privy:${DID_2}`);
    const rawVal = typeof newIndex === 'string' && newIndex.startsWith('"') ? JSON.parse(newIndex) : newIndex;
    assert.equal(rawVal, PUBKEY_C);
  });

  await recordTest('PD-3', 'Privy DID', 'Omitting privyDid during update retains existing privyDid', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: PUBKEY_C, username: 'Charlie_Privy', avatar: 'updated.png' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.privyDid, DID_2);
  });

  await recordTest('PD-4', 'Privy DID', 'GET /api/user query with privyDid parameter', async () => {
    const res = await fetch(`${baseUrl}/api/user?privyDid=${DID_2}`);
    if (res.status === 400) {
      const data = await res.json();
      throw new Error(`GET /api/user does NOT support lookup by privyDid parameter: ${JSON.stringify(data)}`);
    }
    assert.equal(res.status, 200);
  });

  // --------------------------------------------------------------------------
  // Category 4: Missing or Null Fields in Request Payload
  // --------------------------------------------------------------------------
  console.log('\n--- Category 4: Missing or Null Fields in Request Payload ---');

  await recordTest('NF-1', 'Payload Validation', 'POST /api/user with empty body {} returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400, `Expected HTTP 400, got ${res.status}`);
  });

  await recordTest('NF-2', 'Payload Validation', 'POST /api/user with null pubkey returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: null, username: 'Valid_User' })
    });
    assert.equal(res.status, 400, `Expected HTTP 400, got ${res.status}`);
  });

  await recordTest('NF-3', 'Payload Validation', 'POST /api/user with null username returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: PUBKEY_A, username: null })
    });
    assert.equal(res.status, 400, `Expected HTTP 400, got ${res.status}`);
  });

  await recordTest('NF-4', 'Payload Validation', 'POST /api/user with null avatar and null privyDid uses defaults', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: PUBKEY_A, username: 'New_Name', avatar: null, privyDid: null })
    });
    assert.equal(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.user.avatar);
  });

  await recordTest('NF-5', 'Payload Validation', 'POST /api/user with non-string numeric pubkey returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: 1234567890, username: 'Valid_User' })
    });
    assert.equal(res.status, 400, `Expected HTTP 400, got ${res.status}`);
  });

  await recordTest('NF-6', 'Payload Validation', 'POST /api/user with non-string numeric username returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: PUBKEY_A, username: 12345 })
    });
    assert.equal(res.status, 400, `Expected HTTP 400, got ${res.status}`);
  });

  await recordTest('NF-7', 'Payload Validation', 'GET /api/user with no query params returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/user`);
    assert.equal(res.status, 400, `Expected HTTP 400, got ${res.status}`);
  });

  await recordTest('NF-8', 'Payload Validation', 'GET /api/user with empty pubkey parameter (?pubkey=) returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/user?pubkey=`);
    assert.equal(res.status, 400, `Expected HTTP 400, got ${res.status}`);
  });

  await recordTest('NF-9', 'Payload Validation', 'GET /api/user with empty username parameter (?username=) returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/user?username=`);
    assert.equal(res.status, 400, `Expected HTTP 400, got ${res.status}`);
  });

  await server.stop();

  console.log('\n===============================================================');
  console.log('SUMMARY OF EMPIRICAL TEST RESULTS:');
  console.log('===============================================================');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`Total Tests Run: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}\n`);

  if (failed > 0) {
    console.log('Failed Tests Detail:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`- [${r.id}] ${r.description}`);
      console.log(`  Reason: ${r.error}`);
    });
  }
}

runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
