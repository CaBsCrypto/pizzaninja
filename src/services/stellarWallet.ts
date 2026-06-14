import { StellarWalletsKit, WalletNetwork, allowAllModules } from '@creit.tech/stellar-wallets-kit';
import { Keypair } from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

// Ensure buffer is available globally
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
}

// -----------------------------------------------------
// 1. OFFICIAL STELLAR WALLET KIT (Freighter, Albedo, etc.)
// -----------------------------------------------------

export const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: 'freighter',
  modules: allowAllModules(),
});

// -----------------------------------------------------
// 2. PRIVY (GMAIL SEAMLESS ONBOARDING)
// Note: Login is handled entirely within StellarHub via usePrivy.
// We keep a local reference to the deterministic keypair if needed for signing.
// -----------------------------------------------------

export let web3AuthKeypair: Keypair | null = null; // Reusing this name for the deterministic Privy-Stellar keypair to avoid refactoring everywhere

export const setPrivyKeypair = (keypair: Keypair) => {
  web3AuthKeypair = keypair;
};

export const signWithGmailWallet = async (xdr: string, network: string = 'TESTNET'): Promise<string | null> => {
  if (!web3AuthKeypair) return null;
  try {
    const { TransactionBuilder } = await import('@stellar/stellar-sdk');
    const tx = TransactionBuilder.fromXDR(xdr, network === 'TESTNET' ? 'Test SDF Network ; September 2015' : 'Public Global Stellar Network ; September 2015');
    tx.sign(web3AuthKeypair);
    return tx.toXDR();
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const connectWallet = async (): Promise<string | null> => {
  try {
    await kit.openModal({
      onWalletSelected: async (option) => {
        try {
          kit.setWallet(option.id);
          const { address } = await kit.getAddress();
          return address;
        } catch (e) {
          console.error(e);
        }
      }
    });
    // the openModal doesn't strictly return the pubkey from the callback in the same promise flow if it's UI driven, 
    // so we might need to handle this differently in React, but let's just return the address if it's set.
    const { address } = await kit.getAddress();
    return address;
  } catch (error) {
    console.error("Error connecting to wallet:", error);
    return null;
  }
};

export const signWithWallet = async (xdr: string, network: string = 'TESTNET'): Promise<string | null> => {
  try {
    const { address } = await kit.getAddress();
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      networkPassphrase: network === 'TESTNET' ? 'Test SDF Network ; September 2015' : 'Public Global Stellar Network ; September 2015',
      address,
    });
    return signedTxXdr;
  } catch (error) {
    console.error("Error signing transaction:", error);
    return null;
  }
};
