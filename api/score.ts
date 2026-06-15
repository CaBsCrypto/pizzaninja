import { kv } from '@vercel/kv';

export default async function handler(req: any, res: any) {
  // CORS setup for testing/local
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      // Get Global Leaderboard
      const scores = await kv.zrange('slashslice:leaderboard', 0, 9, { rev: true, withScores: true });
      
      // format { member: string, score: number } to something frontend expects
      const formattedScores = [];
      for (let i = 0; i < scores.length; i += 2) {
        formattedScores.push({
          wallet: scores[i],
          score: scores[i + 1]
        });
      }

      return res.status(200).json(formattedScores);
    } 
    else if (req.method === 'POST') {
      // Submit new score
      const { wallet, score, gameMode } = req.body || {};
      
      if (!wallet || score === undefined) {
        return res.status(400).json({ error: 'Missing wallet or score' });
      }

      // Check current score
      const currentScore = await kv.zscore('slashslice:leaderboard', wallet);
      
      if (!currentScore || score > Number(currentScore)) {
        await kv.zadd('slashslice:leaderboard', { score: Number(score), member: wallet });
      }

      return res.status(200).json({ success: true, updated: !currentScore || score > Number(currentScore) });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Error with Vercel KV:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
