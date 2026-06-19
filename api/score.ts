import { kv } from '@vercel/kv';
import pkg from '@stellar/stellar-sdk';
const { Keypair, rpc, TransactionBuilder, Networks } = pkg;

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

  const client = kv as any;

  try {
    if (req.method === 'GET') {
      // Get Global Leaderboard from Vercel KV
      const rawScores = await client.zrange('slashslice:leaderboard_v2', 0, 19, { rev: true });
      
      const formattedScores = [];
      for (const item of rawScores) {
        try {
          if (typeof item === 'string') {
            formattedScores.push(JSON.parse(item));
          } else {
            formattedScores.push(item);
          }
        } catch (e) {
          console.error("Error parsing score record:", e);
        }
      }

      return res.status(200).json(formattedScores);
    } 
    else if (req.method === 'POST') {
      // Submit new score record
      const record = req.body || {};
      const { name, score, pubkey, mode, signedXdr } = record;
      
      if (score === undefined || (!pubkey && !name)) {
        return res.status(400).json({ error: 'Missing identity or score' });
      }

      // Check current score based on pubkey or name
      const identityKey = pubkey || name;
      const currentScore = await client.zscore(`slashslice:scores:${identityKey}`, mode || 'arcade');
      
      let updated = false;
      if (!currentScore || score > Number(currentScore)) {
        // Save score for this user/mode
        await client.zadd(`slashslice:scores:${identityKey}`, { score: Number(score), member: mode || 'arcade' });
        
        // Remove older records for this user in the global leaderboard
        const allGlobalScores = await client.zrange('slashslice:leaderboard_v2', 0, -1);
        for (const itemStr of allGlobalScores) {
          try {
            const item = JSON.parse(itemStr);
            if ((pubkey && item.pubkey === pubkey) || (!pubkey && item.name === name)) {
              if (item.mode === (mode || 'arcade')) {
                await client.zrem('slashslice:leaderboard_v2', itemStr);
              }
            }
          } catch (e) {}
        }

        // Add new record to the global leaderboard
        await client.zadd('slashslice:leaderboard_v2', { score: Number(score), member: JSON.stringify(record) });
        updated = true;
      }

      // Simulate a fallback transaction hash
      let txHash = 'Tx' + Math.random().toString(36).substring(2, 10).toUpperCase() + (pubkey ? pubkey.slice(0, 4) : 'ANON') + 'Sig';

      // On-chain Soroban fee-bump submission if signedXdr is provided
      if (signedXdr && pubkey && !pubkey.startsWith('G') === false) {
        // Check if pubkey is a mock public key
        const isMockWallet = pubkey.length < 56 || pubkey.substring(1, 5) === 'MOCK' || pubkey.substring(1, 5) === 'PASS';
        if (!isMockWallet) {
          try {
            const SECRET_KEY = process.env.ADMIN_SECRET_KEY;
            if (SECRET_KEY) {
              const adminKeypair = Keypair.fromSecret(SECRET_KEY);
              const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');
              
              // Parse inner transaction
              const innerTx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
              
              // Build fee-bump transaction (inclusion fee: 200,000 stroops rate)
              const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
                adminKeypair,
                '200000',
                innerTx,
                Networks.TESTNET
              );
              
              feeBumpTx.sign(adminKeypair);
              
              console.log("[Vercel API] Submitting fee-bumped leaderboard tx...");
              const sendResponse = await rpcServer.sendTransaction(feeBumpTx);
              if (sendResponse.status === 'PENDING') {
                txHash = sendResponse.hash;
              } else {
                console.error("[Vercel API] Fee bump send failed:", sendResponse);
              }
            } else {
              console.warn("[Vercel API] ADMIN_SECRET_KEY missing, skipping on-chain submit.");
            }
          } catch (chainErr) {
            console.error("[Vercel API] Failed on-chain transaction:", chainErr);
          }
        }
      }

      return res.status(200).json({ success: true, updated, txHash });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Error with Vercel KV:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

