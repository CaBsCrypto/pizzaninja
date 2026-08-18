import React, { useState, useEffect } from 'react';
import { Shield, Fingerprint, Key, Zap, CheckCircle2, XCircle, Mail, Award, Loader2, User, Trophy, AlertCircle, Edit3, Sparkles } from 'lucide-react';
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
  domainName?: string;
}

interface StellarHubProps {
  walletState: StellarWalletState;
  setWalletState: React.Dispatch<React.SetStateAction<StellarWalletState>>;
  onToastMessage: (message: string, type: 'success' | 'info' | 'error') => void;
}

interface UserProfile {
  pubkey: string;
  username: string;
  avatar?: string;
  privyDid?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UserStats {
  arcadeScore: number;
  classicScore: number;
  globalRank: number | null;
}

const AVATAR_OPTIONS = [
  { id: 'ninja_default', emoji: '🥷', label: 'Ninja' },
  { id: 'chef_pizza', emoji: '🍕', label: 'Chef' },
  { id: 'blade_master', emoji: '⚔️', label: 'Slicer' },
  { id: 'stellar_legend', emoji: '👑', label: 'Legend' },
];

export default function StellarHub({ walletState, setWalletState, onToastMessage }: StellarHubProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { login, ready, authenticated, user, logout } = usePrivy();
  const { hasNFT, loading: nftLoading } = useSorobanNFTBalance(walletState.publicKey);

  // User Profile & Registration State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [inputUsername, setInputUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('ninja_default');
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Check user profile existence when wallet connects
  useEffect(() => {
    if (!walletState.connected || !walletState.publicKey) {
      setUserProfile(null);
      setUserStats(null);
      setShowRegisterForm(false);
      setIsCheckingProfile(false);
      return;
    }

    const checkUserProfile = async () => {
      setIsCheckingProfile(true);
      setRegistrationError(null);
      try {
        const res = await fetch(`/api/user?pubkey=${encodeURIComponent(walletState.publicKey!)}`);
        const data = await res.json();

        if (res.status === 200 && data.success && data.user) {
          setUserProfile(data.user);
          setUserStats({
            arcadeScore: data.stats?.arcadeScore ?? data.scores?.arcade ?? 0,
            classicScore: data.stats?.classicScore ?? data.scores?.classic ?? 0,
            globalRank: data.stats?.globalRank ?? data.rank?.arcade ?? null
          });
          setShowRegisterForm(false);
        } else {
          // Profile not registered yet
          setUserProfile(null);
          setUserStats(null);
          setShowRegisterForm(true);
        }
      } catch (e) {
        console.error("Error checking user profile existence:", e);
        setShowRegisterForm(true);
      } finally {
        setIsCheckingProfile(false);
      }
    };

    checkUserProfile();
  }, [walletState.connected, walletState.publicKey]);

  // Sync Privy state and Global Cookie with our game's StellarWalletState
  useEffect(() => {
    // 1. Fast-track via global cookie if available (SSO)
    const activeAddress = getWalletCookie();
    if (activeAddress && !walletState.connected) {
      console.log("Sesión activa detectada en Stellar:", activeAddress);
      setWalletState({ connected: true, publicKey: activeAddress, walletType: 'gmail' });
      onToastMessage("Sesión global de SpicyCrust detectada y activa", 'success');
      return;
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
          setPrivyKeypair(keypair);
          
          if (walletState.publicKey !== pubKey) {
            const isProd = window.location.hostname.endsWith('spicycrust.com');
            const domain = isProd ? '; domain=.spicycrust.com' : '';
            document.cookie = `stellar_wallet=${pubKey}${domain}; path=/; max-age=86400; Secure; SameSite=Lax`;

            setWalletState({ connected: true, publicKey: pubKey, walletType: 'gmail' });
            onToastMessage("Sesión compartida de SpicyCrust iniciada", 'success');
            
            try {
              await fetch(`https://friendbot.stellar.org?addr=${pubKey}`);
            } catch(e) {}

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
      setWalletState({ connected: false, publicKey: null, walletType: null });
    }
  }, [ready, authenticated, user]);

  const handleConnectGmail = () => {
    const appId = import.meta.env.VITE_PRIVY_APP_ID || "cmqdk627p00na0cjsi6ioszjx";
    if (appId === "clp2u2k2c000kmt08y8r7u03q" && window.location.hostname !== 'localhost') {
      onToastMessage("⚠️ Debes configurar tu Privy App ID en Vercel para que funcione en producción", 'error');
    }

    if (!ready) {
      onToastMessage("Privy todavía está cargando...", 'info');
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
      kit.openModal({
        onWalletSelected: async (option) => {
          try {
            kit.setWallet(option.id);
            const { address } = await kit.getAddress();
            setWalletState({ connected: true, publicKey: address, walletType: 'freighter' });
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
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
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
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 }
          ],
          authenticatorSelection: {
            userVerification: "preferred"
          },
          timeout: 60000,
          attestation: "none"
        }
      }) as PublicKeyCredential;

      if (credential) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credential.id));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 48);
        const mockStellarPubKey = `G${hexHash.toUpperCase()}`;
        
        setWalletState({ connected: true, publicKey: mockStellarPubKey, walletType: 'passkey' });
        onToastMessage("Passkey conectada (modo demo · billetera simulada)", 'info');
      }
    } catch (e: any) {
      console.error(e);
      onToastMessage("Creación de Passkey cancelada", 'error');
    }
    setIsConnecting(false);
  };

  const handleDisconnect = async () => {
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
    
    setUserProfile(null);
    setUserStats(null);
    setShowRegisterForm(false);
    setIsEditingProfile(false);
    setWalletState({ connected: false, publicKey: null, walletType: null });
    onToastMessage("Bóveda desconectada y sesión global cerrada", 'info');
  };

  // Submit User Registration
  const handleRegisterProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistrationError(null);

    const username = inputUsername.trim();
    if (!username) {
      setRegistrationError("Por favor ingresa un nombre de usuario.");
      return;
    }

    if (username.length < 3 || username.length > 15) {
      setRegistrationError("El usuario debe tener entre 3 y 15 caracteres.");
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,15}$/.test(username)) {
      setRegistrationError("Solo se permiten letras, números y guiones bajos (_).");
      return;
    }

    if (!walletState.publicKey) {
      setRegistrationError("No hay una clave pública conectada.");
      return;
    }

    setIsSubmittingReg(true);
    try {
      const privyDid = user?.id;
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: walletState.publicKey,
          username,
          avatar: selectedAvatar,
          privyDid
        })
      });

      const data = await res.json();

      if (res.status === 201 && data.success && data.user) {
        setUserProfile(data.user);
        setUserStats({
          arcadeScore: 0,
          classicScore: 0,
          globalRank: null
        });
        setShowRegisterForm(false);
        setIsEditingProfile(false);
        onToastMessage(`¡Perfil @${data.user.username} creado exitosamente! 🥷`, 'success');
      } else if (res.status === 409) {
        setRegistrationError("Ese nombre de usuario ya está ocupado.");
      } else {
        setRegistrationError(data.error || "Error al registrar perfil.");
      }
    } catch (err) {
      console.error("Error submitting profile registration:", err);
      setRegistrationError("Error de conexión al guardar perfil.");
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const getAvatarEmoji = (avatarId?: string) => {
    const found = AVATAR_OPTIONS.find(a => a.id === avatarId);
    return found ? found.emoji : '🥷';
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {!walletState.connected ? (
        <>
          <p className="text-sm font-sans text-blue-900 leading-relaxed mb-2 text-center">
            Inicia sesión en el ecosistema Stellar de forma segura para registrar tus puntuaciones.
          </p>

          {/* Main Onboarding: Gmail / Google via Privy */}
          <button
            onClick={handleConnectGmail}
            disabled={isConnecting}
            className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 border-2 border-red-400 text-white rounded-2xl p-4 flex items-center justify-between transition-all group shadow-[0_0_15px_rgba(244,63,94,0.4)] cursor-pointer disabled:opacity-50 relative overflow-hidden active:scale-[0.98]"
          >
            <div className="absolute -left-4 -top-4 w-16 h-16 bg-red-500/20 rounded-full blur-xl group-hover:scale-150 transition-transform" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-red-500/30 p-2 rounded-xl group-hover:scale-110 transition-transform">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h4 className="font-pixel text-xs text-white">Ingresar con Google</h4>
                <span className="font-sans text-[10px] text-red-200 block mt-0.5">Crear billetera instantánea de forma segura</span>
              </div>
            </div>
            <Zap className="w-5 h-5 text-amber-300 animate-pulse relative z-10" />
          </button>

          {/* Toggle panel for advanced dev options */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-vt font-bold text-slate-500 hover:text-slate-700 transition underline cursor-pointer"
            >
              {showAdvanced ? '▲ Ocultar opciones avanzadas' : '▼ Opciones avanzadas de Billeteras'}
            </button>
          </div>

          {/* Advanced options panel */}
          {showAdvanced && (
            <div className="space-y-3 pt-2 border-t border-slate-700/30 animate-[fade-in-up_0.2s_ease-out]">
              <button
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className="w-full bg-slate-900 hover:bg-slate-800 border-2 border-blue-500 text-white rounded-2xl p-3 flex items-center justify-between transition-all group shadow-lg cursor-pointer disabled:opacity-50 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/20 p-2 rounded-xl group-hover:scale-110 transition-transform">
                    <Shield className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-pixel text-[11px] text-blue-100">Billeteras Web3</h4>
                    <span className="font-sans text-[9px] text-blue-300 block mt-0.5">Freighter, Albedo, xBull (Extensión)</span>
                  </div>
                </div>
                <Zap className="w-4 h-4 text-blue-500 group-hover:text-blue-400" />
              </button>

              <button
                onClick={handleConnectPasskey}
                disabled={isConnecting}
                className="w-full bg-gradient-to-r from-indigo-950 to-purple-950 hover:from-indigo-900 hover:to-purple-900 border-2 border-purple-800 text-white rounded-2xl p-3 flex items-center justify-between transition-all group shadow-md cursor-pointer disabled:opacity-50 relative overflow-hidden text-left"
              >
                <div className="absolute -right-4 -top-4 w-12 h-12 bg-purple-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform" />
                <div className="flex items-center gap-3 relative z-10">
                  <div className="bg-purple-500/20 p-2 rounded-xl group-hover:scale-110 transition-transform">
                    <Fingerprint className="w-5 h-5 text-purple-300" />
                  </div>
                  <div>
                    <h4 className="font-pixel text-[11px] text-purple-100 flex items-center gap-1.5">
                      Smart Wallet (Demo)
                    </h4>
                    <span className="font-sans text-[9px] text-purple-300 block mt-0.5">Acceso rápido con Passkey (FaceID / Huella)</span>
                  </div>
                </div>
                <Key className="w-4 h-4 text-purple-400 group-hover:text-purple-300 relative z-10" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-700 shadow-inner">
          {/* Header Wallet Type */}
          <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
            <div className="flex items-center gap-2.5">
              {walletState.walletType === 'freighter' ? (
                <Shield className="w-6 h-6 text-blue-400" />
              ) : (
                <Fingerprint className="w-6 h-6 text-purple-400" />
              )}
              <div>
                <h4 className="font-pixel text-xs text-white flex items-center gap-1.5">
                  Conectado a Stellar
                  {walletState.walletType === 'passkey' && (
                    <span className="text-[7px] bg-purple-500/30 text-purple-200 border border-purple-400/40 px-1 py-0.2 rounded-full font-black tracking-wide uppercase">
                      Demo
                    </span>
                  )}
                </h4>
                <span className="font-sans text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                  {walletState.walletType === 'freighter' ? 'Vía Freighter' : walletState.walletType === 'gmail' ? 'Vía Cuenta de Google' : 'Vía Passkey Smart Wallet'}
                </span>
              </div>
            </div>
            {userProfile && !showRegisterForm && (
              <button
                type="button"
                onClick={() => {
                  setInputUsername(userProfile.username);
                  setSelectedAvatar(userProfile.avatar || 'ninja_default');
                  setIsEditingProfile(true);
                  setShowRegisterForm(true);
                }}
                className="text-slate-400 hover:text-amber-300 transition p-1 cursor-pointer flex items-center gap-1 text-[10px] font-pixel"
                title="Editar Perfil"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
            )}
          </div>

          {/* Loading Profile Spinner */}
          {isCheckingProfile ? (
            <div className="flex items-center justify-center py-6 gap-2 text-slate-400 font-sans text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>Verificando perfil de usuario en Redis...</span>
            </div>
          ) : (showRegisterForm || isEditingProfile) ? (
            /* Registration / Edit Profile Form Modal Component */
            <form onSubmit={handleRegisterProfile} className="bg-slate-950 p-4 rounded-xl border border-amber-500/40 mb-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <h5 className="font-pixel text-xs text-amber-400">
                  {isEditingProfile ? 'Actualizar Perfil de Ninja' : 'Registrar Nuevo Perfil'}
                </h5>
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                Ingresa un nombre de usuario único (3-15 caracteres alfanuméricos o `_`) para vincular con tu clave pública Stellar.
              </p>

              {registrationError && (
                <div className="bg-red-500/20 border border-red-500/40 p-2 rounded-lg text-[11px] text-red-300 flex items-center gap-1.5 font-sans">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>{registrationError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-pixel text-slate-400 uppercase mb-1">Nombre de Usuario</label>
                <input
                  type="text"
                  value={inputUsername}
                  onChange={(e) => setInputUsername(e.target.value)}
                  placeholder="Ninja_Master"
                  maxLength={15}
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm font-mono focus:border-amber-400 focus:outline-none"
                />
                <span className="text-[9px] text-slate-500 block mt-1 font-sans">
                  3 a 15 caracteres (A-Z, 0-9, _)
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-pixel text-slate-400 uppercase mb-1">Elige tu Avatar</label>
                <div className="grid grid-cols-4 gap-2">
                  {AVATAR_OPTIONS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setSelectedAvatar(av.id)}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                        selectedAvatar === av.id
                          ? 'bg-amber-500/20 border-amber-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xl">{av.emoji}</span>
                      <span className="text-[8px] font-pixel">{av.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSubmittingReg}
                  className="btn-clash-gold w-full py-2 text-xs font-pixel uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingReg ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isEditingProfile ? 'Guardar Cambios' : 'Registrar Perfil'}</span>
                    </>
                  )}
                </button>
                {isEditingProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterForm(false);
                      setIsEditingProfile(false);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl px-3 text-xs font-pixel cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          ) : userProfile ? (
            /* Registered User Profile Badge & High Scores */
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-amber-400/60 flex items-center justify-center text-2xl shadow-md">
                    {getAvatarEmoji(userProfile.avatar)}
                  </div>
                  <div>
                    <h5 className="font-pixel text-sm text-amber-300 flex items-center gap-1.5">
                      @{userProfile.username}
                    </h5>
                    <span className="font-sans text-[10px] text-slate-400 block">
                      Ninja Registrado
                    </span>
                  </div>
                </div>
                {userStats?.globalRank !== null && userStats?.globalRank !== undefined && (
                  <div className="bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg text-center">
                    <span className="text-[8px] font-pixel text-amber-400 block uppercase">Rank Global</span>
                    <span className="font-sans text-xs font-black text-amber-300">#{userStats.globalRank}</span>
                  </div>
                )}
              </div>

              {/* High Scores Display Grid */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-[9px] font-pixel text-slate-400 uppercase block mb-0.5 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    Récord Arcade
                  </span>
                  <span className="font-sans text-sm font-bold text-white">
                    {userStats?.arcadeScore ?? 0} <span className="text-[10px] text-slate-400">pts</span>
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-[9px] font-pixel text-slate-400 uppercase block mb-0.5 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-blue-400" />
                    Récord Classic
                  </span>
                  <span className="font-sans text-sm font-bold text-white">
                    {userStats?.classicScore ?? 0} <span className="text-[10px] text-slate-400">pts</span>
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Pubkey box */}
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 mb-4 break-all">
            <span className="font-mono text-[10px] text-slate-400 block uppercase tracking-wider mb-0.5">Clave Pública Stellar:</span>
            <span className="font-mono text-[10px] text-slate-200 select-all">
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
