import { StellarWalletsKit, WalletNetwork, allowAllModules } from '@creit.tech/stellar-wallets-kit';
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES } from "@web3auth/base";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
import { Keypair } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";

export const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: 'freighter',
  modules: allowAllModules(),
});

// Web3Auth Initialization
const clientId = "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiIQKQweLAHDshKpYGLm0k7D2v3mD2K9N_A-c"; // Default Sapphire Devnet Client ID

export const web3auth = new Web3Auth({
  clientId,
  web3AuthNetwork: "sapphire_devnet",
  chainConfig: {
    chainNamespace: CHAIN_NAMESPACES.OTHER,
    chainId: "testnet",
    rpcTarget: "https://horizon-testnet.stellar.org",
    displayName: "Stellar Testnet",
    blockExplorerUrl: "https://stellar.expert/explorer/testnet",
    ticker: "XLM",
    tickerName: "Stellar Lumens",
  },
});

const openloginAdapter = new OpenloginAdapter({
  adapterSettings: {
    uxMode: "popup",
  },
});
web3auth.configureAdapter(openloginAdapter);

export const initWeb3Auth = async () => {
  try {
    await web3auth.initModal();
  } catch (error) {
    console.error("Web3Auth init failed", error);
  }
};

export let web3AuthKeypair: Keypair | null = null;

export const connectGmailWallet = async (): Promise<string | null> => {
  try {
    if (!web3auth.connected) {
      await web3auth.connect();
    }
    const privateKeyHex = await web3auth.provider?.request({ method: "private_key" }) as string;
    if (privateKeyHex) {
      const seedHex = privateKeyHex.padStart(64, '0').slice(0, 64);
      const seedBytes = new Uint8Array(seedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      web3AuthKeypair = Keypair.fromRawEd25519Seed(Buffer.from(seedBytes));
      
      const publicKey = web3AuthKeypair.publicKey();
      
      // Auto-fund new account on Testnet using Friendbot
      try {
        console.log("Funding account with Friendbot...");
        await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
      } catch (e) {
        console.warn("Friendbot funding failed (maybe already funded)");
      }
      
      return publicKey;
    }
    return null;
  } catch (error) {
    console.error("Gmail connect error:", error);
    return null;
  }
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
