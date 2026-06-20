import { useState, useEffect, useCallback } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import { CONTRACTS, SOROBAN_RPC_URL, SOROBAN_NETWORK_PASSPHRASE } from '../services/contractConfig';

export function useSorobanNFTBalance(publicKey: string | null) {
  const [hasNFT, setHasNFT] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNFTBalance = useCallback(async () => {
    if (!publicKey) {
      setHasNFT(false);
      return;
    }

    // 1. Developer testing bypass (localStorage override or mock keys)
    if (
      localStorage.getItem('mock_has_nft') === 'true' ||
      publicKey.includes('MOCK') ||
      publicKey.includes('PASS')
    ) {
      console.log("[NFT Hook] Test/mock bypass active. Setting hasNFT = true.");
      setHasNFT(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const contract = new StellarSdk.Contract(CONTRACTS.OVEN_NFT);
      const sourceAccount = new StellarSdk.Account(publicKey, "0");
      const addressVal = new StellarSdk.Address(publicKey).toScVal();

      let simulation: any = null;
      let callSuccess = false;

      // Method Try 1: balance_of (standard ERC-721/Soroban NFT)
      try {
        const txBuilder1 = new StellarSdk.TransactionBuilder(sourceAccount, {
          fee: '100',
          networkPassphrase: SOROBAN_NETWORK_PASSPHRASE,
        });
        txBuilder1.addOperation(contract.call('balance_of', addressVal));
        const tx1 = txBuilder1.setTimeout(30).build();
        const sim = await server.simulateTransaction(tx1);

        if (!StellarSdk.rpc.Api.isSimulationError(sim)) {
          simulation = sim;
          callSuccess = true;
          console.log("[NFT Hook] Successfully queried NFT balance using balance_of.");
        }
      } catch (err) {
        console.warn("[NFT Hook] balance_of query failed, attempting balance fallback...");
      }

      // Method Try 2: balance (standard SEP-0041/ERC-20 style fallback)
      if (!callSuccess) {
        try {
          const txBuilder2 = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: '100',
            networkPassphrase: SOROBAN_NETWORK_PASSPHRASE,
          });
          txBuilder2.addOperation(contract.call('balance', addressVal));
          const tx2 = txBuilder2.setTimeout(30).build();
          const sim = await server.simulateTransaction(tx2);

          if (!StellarSdk.rpc.Api.isSimulationError(sim)) {
            simulation = sim;
            callSuccess = true;
            console.log("[NFT Hook] Successfully queried NFT balance using balance.");
          } else {
            console.error("[NFT Hook] Simulation error on balance fallback:", sim.error);
          }
        } catch (err) {
          console.error("[NFT Hook] balance fallback query failed:", err);
        }
      }

      if (callSuccess && simulation && simulation.result && simulation.result.retval) {
        const scVal = simulation.result.retval;
        const balanceBigInt = StellarSdk.scValToNative(scVal);
        const normalBalance = Number(balanceBigInt);
        
        console.log(`[NFT Hook] NFT balance resolved to: ${normalBalance}`);
        setHasNFT(normalBalance > 0);
      } else {
        // If contract simulation failed (e.g. contract not fully deployed/initialized on testnet)
        // check if player previously successfully minted to trigger a local fallback
        const isLocallyMinted = localStorage.getItem('slash_slice_nft_minted') === 'true';
        if (isLocallyMinted) {
          console.log("[NFT Hook] On-chain query failed, but local mint record found. Treating as owned.");
          setHasNFT(true);
        } else {
          setHasNFT(false);
        }
      }
    } catch (e: any) {
      console.error("Soroban NFT read error:", e);
      setError(e.message);
      
      // Fail-soft to local mint history to keep UX seamless
      const isLocallyMinted = localStorage.getItem('slash_slice_nft_minted') === 'true';
      setHasNFT(isLocallyMinted);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchNFTBalance();
  }, [fetchNFTBalance]);

  return { hasNFT, loading, error, refetch: fetchNFTBalance };
}
