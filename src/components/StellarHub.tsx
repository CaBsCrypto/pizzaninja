import React, { useState } from 'react';
import { Shield, Fingerprint, Key, Zap, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { connectWallet, kit, initWeb3Auth, connectGmailWallet } from '../services/stellarWallet';

export interface StellarWalletState {
  connected: boolean;
  publicKey: string | null;
  walletType: 'freighter' | 'passkey' | 'gmail' | null;
}

interface StellarHubProps {
  walletState: StellarWalletState;
  setWalletState: React.Dispatch<React.SetStateAction<StellarWalletState>>;
  onToastMessage: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function StellarHub({ walletState, setWalletState, onToastMessage }: StellarHubProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  React.useEffect(() => {
    initWeb3Auth();
  }, []);

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    try {
      const publicKey = await connectGmailWallet();
      if (publicKey) {
        setWalletState({ connected: true, publicKey, walletType: 'gmail' });
        onToastMessage("Cuenta creada y conectada con Gmail", 'success');
      } else {
        onToastMessage("Fallo al conectar con Google", 'error');
      }
    } catch (e) {
      console.error(e);
      onToastMessage("Error en el login de Gmail", 'error');
    }
    setIsConnecting(false);
  };

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    try {
      // openModal is handled by our service wrapper, but it opens the official SDK UI
      kit.openModal({
        onWalletSelected: async (option) => {
          try {
            kit.setWallet(option.id);
            const { address } = await kit.getAddress();
            setWalletState({ connected: true, publicKey: address, walletType: 'freighter' }); // Using 'freighter' as general wallet type for now
            onToastMessage(`Bóveda conectada: ${option.name}`, 'success');
          } catch (e) {
            console.error(e);
            onToastMessage("Conexión rechazada", 'error');
          }
        }
      });
    } catch (e) {
      onToastMessage("Error al abrir selector de wallets", 'error');
    }
    setIsConnecting(false);
  };

  const handleConnectPasskey = async () => {
    setIsConnecting(true);
    try {
      // Create a random challenge for the WebAuthn API
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      // Simulate Passkey creation / assertion using WebAuthn standard
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: "Slash Slice Stellar", id: window.location.hostname },
          user: {
            id: new Uint8Array(16),
            name: "ninja@slashslice.com",
            displayName: "Pizza Ninja"
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },   // ES256
            { type: "public-key", alg: -257 }  // RS256 (Windows Hello)
          ],
          authenticatorSelection: {
            userVerification: "preferred"
          },
          timeout: 60000,
          attestation: "none"
        }
      }) as PublicKeyCredential;

      if (credential) {
        // Derive a mock Stellar G-address based on the passkey ID for the hackathon UI
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credential.id));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 48);
        const mockStellarPubKey = `G${hexHash.toUpperCase()}`;
        
        setWalletState({ connected: true, publicKey: mockStellarPubKey, walletType: 'passkey' });
        onToastMessage("Smart Wallet (Passkey) conectada con éxito", 'success');
      }
    } catch (e: any) {
      console.error(e);
      onToastMessage("Creación de Passkey cancelada", 'error');
    }
    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    setWalletState({ connected: false, publicKey: null, walletType: null });
    onToastMessage("Billetera desconectada", 'info');
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {!walletState.connected ? (
        <>
          <p className="text-sm font-sans text-blue-900 leading-relaxed mb-2">
            Inicia sesión en el ecosistema Stellar de forma segura para registrar tus puntuaciones en el ledger.
          </p>

          {/* Multi-Wallet Button */}
          <button
            onClick={handleConnectWallet}
            disabled={isConnecting}
            className="w-full bg-slate-900 hover:bg-slate-800 border-2 border-blue-500 text-white rounded-2xl p-4 flex items-center justify-between transition-all group shadow-lg cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-2 rounded-xl group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-left">
                <h4 className="font-pixel text-xs text-blue-100">Billeteras Web3</h4>
                <span className="font-sans text-[10px] text-blue-300 block mt-0.5">Albedo, Freighter, xBull...</span>
              </div>
            </div>
            <Zap className="w-5 h-5 text-blue-500 group-hover:text-blue-400" />
          </button>

          {/* Passkeys Button */}
          <button
            onClick={handleConnectPasskey}
            disabled={isConnecting}
            className="w-full bg-gradient-to-r from-indigo-900 to-purple-900 hover:from-indigo-800 hover:to-purple-800 border-2 border-purple-500 text-white rounded-2xl p-4 flex items-center justify-between transition-all group shadow-[0_0_15px_rgba(168,85,247,0.4)] cursor-pointer disabled:opacity-50 relative overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-purple-500/20 rounded-full blur-xl group-hover:scale-150 transition-transform" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-purple-500/30 p-2 rounded-xl group-hover:scale-110 transition-transform">
                <Fingerprint className="w-6 h-6 text-purple-300" />
              </div>
              <div className="text-left">
                <h4 className="font-pixel text-xs text-purple-100">Smart Wallet</h4>
                <span className="font-sans text-[10px] text-purple-300 block mt-0.5">Accede con Passkeys (FaceID / Huella)</span>
              </div>
            </div>
            <Key className="w-5 h-5 text-purple-400 group-hover:text-purple-300 relative z-10" />
          </button>

          {/* Gmail / Web3Auth Button */}
          <button
            onClick={handleConnectGmail}
            disabled={isConnecting}
            className="w-full bg-gradient-to-r from-red-900 to-rose-900 hover:from-red-800 hover:to-rose-800 border-2 border-red-500 text-white rounded-2xl p-4 flex items-center justify-between transition-all group shadow-[0_0_15px_rgba(244,63,94,0.4)] cursor-pointer disabled:opacity-50 relative overflow-hidden"
          >
            <div className="absolute -left-4 -top-4 w-16 h-16 bg-red-500/20 rounded-full blur-xl group-hover:scale-150 transition-transform" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-red-500/30 p-2 rounded-xl group-hover:scale-110 transition-transform">
                <Mail className="w-6 h-6 text-red-300" />
              </div>
              <div className="text-left">
                <h4 className="font-pixel text-xs text-red-100">Crear Billetera Instantánea</h4>
                <span className="font-sans text-[10px] text-red-300 block mt-0.5">Ingresar con Gmail / Google</span>
              </div>
            </div>
            <Zap className="w-5 h-5 text-red-400 group-hover:text-red-300 relative z-10" />
          </button>
        </>
      ) : (
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-700 shadow-inner">
          <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-3">
            {walletState.walletType === 'freighter' ? (
              <Shield className="w-8 h-8 text-blue-400" />
            ) : (
              <Fingerprint className="w-8 h-8 text-purple-400" />
            )}
            <div>
              <h4 className="font-pixel text-sm text-white">Conectado a Stellar</h4>
              <span className="font-sans text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                {walletState.walletType === 'freighter' ? 'Vía Freighter' : walletState.walletType === 'gmail' ? 'Vía Cuenta de Google' : 'Vía Passkey Smart Wallet'}
              </span>
            </div>
          </div>
          
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4 break-all">
            <span className="font-mono text-[10px] text-slate-300 select-all">
              {walletState.publicKey}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <a 
              href={`https://stellar.expert/explorer/testnet/account/${walletState.publicKey}`} 
              target="_blank" 
              rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 font-sans font-medium flex items-center gap-1"
            >
              Ver en Explorer ↗
            </a>
            <button 
              onClick={handleDisconnect}
              className="text-rose-400 hover:text-rose-300 font-pixel text-[10px] flex items-center gap-1 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              Desconectar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
