import { StellarWalletsKit, WalletNetwork, allowAllModules } from '@creit.tech/stellar-wallets-kit';

export const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: 'freighter',
  modules: allowAllModules(),
});

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
