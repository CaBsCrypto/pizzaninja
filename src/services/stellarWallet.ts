import {
  isConnected,
  getPublicKey,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api';

export const isFreighterInstalled = async (): Promise<boolean> => {
  try {
    return await isConnected();
  } catch (error) {
    console.error("Error checking Freighter installation:", error);
    return false;
  }
};

export const connectFreighter = async (): Promise<string | null> => {
  try {
    const access = await requestAccess();
    if (access) {
      const pubKey = await getPublicKey();
      return pubKey;
    }
    return null;
  } catch (error) {
    console.error("Error connecting to Freighter:", error);
    return null;
  }
};

export const signWithFreighter = async (xdr: string, network: string = 'TESTNET'): Promise<string | null> => {
  try {
    const signedTx = await signTransaction(xdr, { network });
    return signedTx;
  } catch (error) {
    console.error("Error signing transaction:", error);
    return null;
  }
};
