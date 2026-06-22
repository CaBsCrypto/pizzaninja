import React, { useState, useEffect } from 'react';
import { Shield, Fingerprint, Key, Zap, CheckCircle2, XCircle, Mail, Award, Loader2 } from 'lucide-react';
import { kit, setPrivyKeypair } from '../services/stellarWallet';
import { usePrivy } from '@privy-io/react-auth';
import { Keypair } from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';
import { useSorobanNFTBalance } from '../hooks/useSorobanNFTBalance';

// Helper para leer cookies compartidas de SpicyCrust
export function getWalletCookie(): string | null {
  const match = document.cookie.match(new RegExp('(^| )stellar_wallet=([^;]+)'));
  return match ? match[2] : null;
}

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
  const { login, ready, authenticated, user, logout } = usePrivy();
  const { hasNFT, loading: nftLoading } = useSorobanNFTBalance(walletState.publicKey);

  // Sync Privy state and Global Cookie with our game's StellarWalletState
  useEffect(() => {
    // 1. Fast-track via global cookie if available (SSO)
    const activeAddress = getWalletCookie();
    if (activeAddress && !walletState.connected) {
      console.log("Sesión activa detectada en Stellar:", activeAddress);
      setWalletState({ connected: true, publicKey: activeAddress, walletType: 'gmail' }); // Representa la sesión compartida
      onToastMessage("Sesión global de SpicyCrust detectada y activa", 'success');
      return; // Skip Privy derivation since we already have the identity
    }

    if (ready && authenticated && user && !activeAddress) {
      // 2. Derive deterministic Stellar Keypair from Privy DID as the definitive global identity
      const deriveStellarKey = async () => {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(user.id + "_spicycrust_privy_shared_salt_2026");
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = new Uint8Array(hashBuffer);
          const keypair = Keypair.fromRawEd25519Seed(Buffer.from(hashArray));
          const pubKey = keypair.publicKey();
          setPrivyKeypair(keypair); // Save the keypair locally for signing transactions later
          
          if (walletState.publicKey !== pubKey) {
            // Guardar la sesión en la Cookie del dominio compartido (.spicycrust.com)
            const isProd = window.location.hostname.endsWith('spicycrust.com');
            const domain = isProd ? '; domain=.spicycrust.com' : '';
            document.cookie = `stellar_wallet=${pubKey}${domain}; path=/; max-age=86400; Secure; SameSite=Lax`;

            setWalletState({ connected: true, publicKey: pubKey, walletType: 'gmail' });
            onToastMessage("Sesión compartida de SpicyCrust iniciada", 'success');
            
            // Try funding if it's new
            try {
              await fetch(`https://friendbot.stellar.org?addr=${pubKey}`);
            } catch(e) {}

            // Redirect back to lobby if requested
            const params = new URLSearchParams(window.location.search);
            if (params.get('redirect') === 'lobby') {
              window.location.href = isProd ? 'https://spicycrust.com' : 'http://localhost:5173';
            }
          }
        } catch (e) {
          console.error("Error deriving Stellar key from Privy", e);
        }
      };
      deriveStellarKey();
    } else if (ready && !authenticated && walletState.walletType === 'gmail' && !activeAddress) {
      // If Privy is logged out and no cookie exists, clean up
      setWalletState({ connected: false, publicKey: null, walletType: null });
    }
  }, [ready, authenticated, user]);

  const handleConnectGmail = () => {
    // If we're using the dummy App ID and the domain isn't localhost, Privy will fail.
    const appId = import.meta.env.VITE_PRIVY_APP_ID || "cmqdk627p00na0cjsi6ioszjx";
    if (appId === "clp2u2k2c000kmt08y8r7u03q" && window.location.hostname !== 'localhost') {
      onToastMessage("⚠️ Debes configurar tu Privy App ID en Vercel para que funcione en producción", 'error');
      // Let it try anyway so they see the console error
    }

    if (!ready) {
      onToastMessage("Privy todavía está cargando (o el App ID es inválido)...", 'info');
      return;
    }
    
    try {
      login();
    } catch (e) {
      console.error("Privy login error:", e);
      onToastMessage("Error al abrir Privy", 'error');
    }
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

  const handleDisconnect = async () => {
    // Clear global cookie
    const isProd = window.location.hostname.endsWith('spicycrust.com');
    const domain = isProd ? '; domain=.spicycrust.com' : '';
    document.cookie = `stellar_wallet=; path=/; max-age=0${domain}; Secure; SameSite=Lax`;

    try {
      await kit.disconnect();
    } catch(e) {}
    
    if (walletState.walletType === 'gmail') {
      try {
        await logout();
      } catch (e) {}
    }
    
    setWalletState({ connected: false, publicKey: null, walletType: null });
    onToastMessage("Bóveda desconectada y sesión global cerrada", 'info');
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

          {/* Sección de Coleccionables (NFTs) */}
          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 mb-4">
            <h5 className="font-pixel text-[9px] text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              Coleccionables (NFTs)
            </h5>
            
            <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍕</span>
                <div className="text-left text-stroke-none">
                  <span className="font-pixel text-[9px] text-white block">Oven Collectible</span>
                  <span className="font-sans text-[8px] text-slate-500 block">Utilidad en Spicy Crust</span>
                </div>
              </div>
              
              {nftLoading ? (
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              ) : hasNFT ? (
                <span className="flex items-center gap-1 text-[8px] text-emerald-400 font-pixel bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  POSEÍDO
                </span>
              ) : (
                <span className="text-[8px] text-slate-500 font-sans italic">
                  No detectado
                </span>
              )}
            </div>
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
