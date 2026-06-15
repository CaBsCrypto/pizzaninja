import { kv } from '@vercel/kv';

export default async function handler(req: any, res: any) {
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
      const { wallet } = req.query;
      if (!wallet) return res.status(400).json({ error: 'Wallet required' });

      // Get user data from KV
      const data = await kv.hgetall(`slashslice:wallet:${wallet}`);
      return res.status(200).json(data || { ingredients: 0, items: [] });
    }
    
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Error in wallet API:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
