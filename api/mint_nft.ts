import pkg from '@stellar/stellar-sdk';
import { kv } from '@vercel/kv';
const { Keypair, rpc, TransactionBuilder, Networks, Contract, Address } = pkg;

const STELLAR_PUBKEY_RE = /^G[A-Z2-7]{55}$/;
const RL_MAX = 5;
const RL_WINDOW_SECONDS = 60;

// --- CORS -----------------------------------------------------------------
// ALLOWED_ORIGIN must be set to the exact production origin. Never fall back
// to "*": this endpoint signs and broadcasts real on-chain NFT mints with the
// admin key, so an open origin would let any third-party site trigger mints
// on behalf of visiting users. Access-Control-Allow-Credentials is
// intentionally NOT set (no cookie-based auth is used here), since "*" +
// credentials is forbidden by the CORS spec.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

function corsHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
  if (ALLOWED_ORIGIN) {
    headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return headers;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(),
  });
}

async function isRateLimited(address: string): Promise<boolean> {
  try {
    const key = `mintnft:rl:${address}`;
    const client = kv as any;
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, RL_WINDOW_SECONDS);
    return count > RL_MAX;
  } catch (e) {
    console.warn('[mint_nft] KV rate-limit unavailable, failing open:', e);
    return false;
  }
}

// Polls getTransaction until the network reports a terminal status (SUCCESS
// or FAILED) or the deadline is hit. sendTransaction's "PENDING" only means
// the node accepted the tx into its queue — it is NOT proof of on-chain
// success, so we must confirm before ever reporting success:true.
async function confirmTransaction(
  rpcServer: InstanceType<typeof rpc.Server>,
  hash: string,
  { timeoutMs = 20_000, intervalMs = 1_500 } = {},
): Promise<{ confirmed: boolean; status: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await rpcServer.getTransaction(hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { confirmed: true, status: res.status };
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      return { confirmed: false, status: res.status };
    }
    // NOT_FOUND => still propagating; keep polling.
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { confirmed: false, status: 'TIMEOUT' };
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method Not Allowed' }, 405);
  }

  let playerAddress: unknown;
  // TODO(security): `signedXdr` / user-authenticated signature is not yet
  // accepted or required here. Today the admin key alone authorizes the mint
  // for whatever playerAddress the client sends, so any caller who can reach
  // this endpoint (subject to CORS + rate limit) can request an NFT mint to
  // an arbitrary address. To make this properly non-custodial we need the
  // client to prove control of `playerAddress` (e.g. via a Privy-issued
  // session token verified server-side, or a user-signed challenge tied to
  // the current session) before honoring the request. Not implemented in
  // this pass — needs explicit design input on how Privy/StellarHub
  // identifies "the current user" before enforcing this.
  try {
    ({ playerAddress } = await req.json());
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  if (typeof playerAddress !== 'string' || !STELLAR_PUBKEY_RE.test(playerAddress)) {
    return json({ success: false, error: 'Invalid playerAddress' }, 400);
  }

  if (await isRateLimited(playerAddress)) {
    return json({ success: false, error: 'Rate limit exceeded. Try again shortly.' }, 429);
  }

  const SECRET_KEY = process.env.ADMIN_SECRET_KEY;
  if (!SECRET_KEY) {
    console.error('[mint_nft] ADMIN_SECRET_KEY is not configured.');
    return json({ success: false, error: 'Server configuration error' }, 500);
  }

  try {
    const adminKeypair = Keypair.fromSecret(SECRET_KEY);
    const rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');

    const NFT_CONTRACT_ID = 'CBC3AGOZTWKEII45VBRWLOGMBNGBJ6ABPP6MOFAZM2HFHP2NKPXXEWXB';
    const contract = new Contract(NFT_CONTRACT_ID);
    const toAddressScVal = new Address(playerAddress).toScVal();

    const sourceAccount = await rpcServer.getAccount(adminKeypair.publicKey());
    const tx = new TransactionBuilder(sourceAccount, {
      fee: '15000',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call('mint', toAddressScVal))
      .setTimeout(30)
      .build();

    const simulation = await rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simulation)) {
      console.error('[mint_nft] Simulation error:', simulation.error);
      return json({ success: false, error: 'On-chain simulation failed' }, 502);
    }

    const assembledTx = rpc.assembleTransaction(tx, simulation).build();
    assembledTx.sign(adminKeypair);

    const sendResponse = await rpcServer.sendTransaction(assembledTx);
    if (sendResponse.status !== 'PENDING') {
      console.error('[mint_nft] Transaction rejected:', sendResponse.status);
      return json({ success: false, error: `Transaction rejected: ${sendResponse.status}` }, 502);
    }

    // "PENDING" only means the node accepted the tx into its queue, not that
    // it landed successfully — confirm before ever returning success:true.
    const confirmation = await confirmTransaction(rpcServer, sendResponse.hash);
    if (!confirmation.confirmed) {
      console.error('[mint_nft] Transaction not confirmed:', confirmation.status);
      return json(
        { success: false, error: `Transaction not confirmed: ${confirmation.status}`, txHash: sendResponse.hash },
        502,
      );
    }

    return json({
      success: true,
      message: '¡Transacción NFT confirmada en la Testnet!',
      txHash: sendResponse.hash,
    });
  } catch (error: any) {
    console.error('[mint_nft] Error:', error);
    return json({ success: false, error: 'NFT mint failed' }, 500);
  }
}
