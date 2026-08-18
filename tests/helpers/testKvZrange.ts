import { MockKvServer } from './mockKvServer.js';

async function run() {
  const server = new MockKvServer();
  await server.start();
  const { kv } = await import('@vercel/kv');
  await kv.zadd('test_z', { score: 100, member: 'user_a' });
  await kv.zadd('test_z', { score: 200, member: 'user_b' });

  const res1 = await kv.zrange('test_z', 0, -1, { rev: true, withScores: true });
  console.log('ZBANG WITH SCORES:', JSON.stringify(res1));

  const res2 = await kv.zrange('test_z', 0, -1, { rev: true });
  console.log('ZBANG WITHOUT SCORES:', JSON.stringify(res2));

  await server.stop();
  process.exit(0);
}

run().catch(console.error);
