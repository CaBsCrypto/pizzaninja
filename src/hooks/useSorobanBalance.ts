import { useState, useEffect, useCallback } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import { CONTRACTS, SOROBAN_RPC_URL, SOROBAN_NETWORK_PASSPHRASE } from '../services/contractConfig';

export function useSorobanBalance(publicKey: string | null) {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const contract = new StellarSdk.Contract(CONTRACTS.SLICE_TOKEN);

      // Creamos una transacción "dummy" solo para simular la llamada de lectura
      const sourceAccount = new StellarSdk.Account(publicKey, "0"); // Cuenta temporal
      const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: '100',
        networkPassphrase: SOROBAN_NETWORK_PASSPHRASE,
      });

      const addressVal = new StellarSdk.Address(publicKey).toScVal();
      
      txBuilder.addOperation(contract.call('balance', addressVal));
      const tx = txBuilder.setTimeout(30).build();

      const simulation = await server.simulateTransaction(tx);

      if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
        console.error("Error al consultar saldo:", simulation.error);
        setError("No se pudo leer el saldo.");
        return;
      }

      if (simulation.result && simulation.result.retval) {
        // Parseamos el resultado (esperamos un ScVal i128)
        const scVal = simulation.result.retval;
        const balanceBigInt = StellarSdk.scValToNative(scVal);
        
        // Asumiendo que 1 token tiene 7 decimales
        const normalBalance = Number(balanceBigInt) / 10_000_000;
        setBalance(normalBalance);
      }
    } catch (e: any) {
      console.error("Soroban read error:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  // Actualizar balance al montar o cuando cambie la llave pública
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, error, refetch: fetchBalance };
}
