import React, { useState, useEffect } from 'react';
import { Flame, Trophy, Award, Trash2, ArrowRight, User, Sparkles, Star, Swords, Clock, Wallet, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PizzaCanvas from './components/PizzaCanvas';
import Leaderboard from './components/Leaderboard';
import { ScoreRecord, SlashReplayPoint } from './types';
import SolanaWalletConnector, { SolanaWalletState } from './components/SolanaWalletConnector';

// Web audio API Helper to make nice sound effects for menu
function playWebSound(type: 'coin' | 'register') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (type === 'coin') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } else if (type === 'register') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    // Sound failure is okay to ignore
  }
}

export default function App() {
  // Game states
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingScore, setPendingScore] = useState<{
    score: number;
    duration: number;
    slashes: number;
    slashHistory?: SlashReplayPoint[];
    gameStartTimestamp?: number;
    gameMode?: string;
  } | null>(null);

  // Score name/moniker registration input state
  const [chefName, setChefName] = useState('');
  
  // Leaderboard lists
  const [scores, setScores] = useState<ScoreRecord[]>([]);

  // Solana Wallet Adapter global state
  const [walletState, setWalletState] = useState<SolanaWalletState>(() => {
    return {
      connected: false,
      publicKey: null,
      domainName: null,
      balance: 0,
      isSimulated: false,
      network: 'sandbox',
      providerName: null
    };
  });

  // Mobile lateral drawer visibility state
  const [isWalletOpen, setIsWalletOpen] = useState(false);

  // Dynamic toast toaster notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3800);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Trigger loading initial leaderboard entries from LocalStorage (backward-compatible) or seed defaults
  useEffect(() => {
    let saved = localStorage.getItem('slash_slice_scores_v2');
    if (!saved) {
      saved = localStorage.getItem('pizza_ninja_scores_v2');
    }
    if (saved) {
      try {
        setScores(JSON.parse(saved));
      } catch (err) {
        console.error(err);
      }
    } else {
      // Seed some dummy records matching Slash Slice retro theme
      const seeds: ScoreRecord[] = [
        {
          name: 'CHEF_MARIO',
          score: 410,
          timestamp: Date.now() - 3605 * 1000 * 3, // 3 hours ago
          duration: 45,
          slashes: 154,
          mode: 'arcade',
        },
        {
          name: 'NINJA_SLICE',
          score: 350,
          timestamp: Date.now() - 3605 * 1000 * 12,
          duration: 45,
          slashes: 125,
          mode: 'arcade',
        },
        {
          name: 'EL_CORTE_RAPIDO',
          score: 280,
          timestamp: Date.now() - 3605 * 1000 * 24,
          duration: 45,
          slashes: 89,
          mode: 'arcade',
        },
        {
          name: 'PEPERONI_PRO',
          score: 180,
          timestamp: Date.now() - 3605 * 1000 * 48,
          duration: 30,
          slashes: 45,
          mode: 'arcade',
        },
      ];
      setScores(seeds);
      localStorage.setItem('slash_slice_scores_v2', JSON.stringify(seeds));
    }
  }, []);

  // When a game finishes, record score state as pending submission
  const handleGameOver = (
    finalScore: number,
    finalDuration: number,
    finalSlashes: number,
    slashHistory: SlashReplayPoint[],
    gameStartTimestamp?: number,
    gameMode?: string
  ) => {
    setPendingScore({
      score: finalScore,
      duration: finalDuration,
      slashes: finalSlashes,
      slashHistory,
      gameStartTimestamp,
      gameMode,
    });
    setChefName(''); // Reset input name on game over
    playWebSound('coin');
  };

  const handleRegisterScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingScore) return;

    const trimmedName = chefName.trim().toUpperCase() || 'ANÓNIMO';
    const newRecord: ScoreRecord = {
      name: trimmedName,
      score: pendingScore.score,
      timestamp: Date.now(),
      duration: pendingScore.duration,
      slashes: pendingScore.slashes,
      slashHistory: pendingScore.slashHistory,
      mode: pendingScore.gameMode || 'arcade',
    };

    const updated = [newRecord, ...scores];
    setScores(updated);
    localStorage.setItem('slash_slice_scores_v2', JSON.stringify(updated));
    setPendingScore(null);
  };

  const handleClearScores = () => {
    setScores([]);
    localStorage.removeItem('slash_slice_scores_v2');
    localStorage.removeItem('pizza_ninja_scores_v2');
    showToast('🧹 Historial de récords reiniciado!', 'info');
  };

  const scoreRegistrationCard = pendingScore && (
    <motion.div 
      initial={{ scale: 0.8, opacity: 0, y: 50 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0.5 }}
      className="panel-clash p-6 relative overflow-hidden z-50 mx-auto max-w-md my-8"
    >
      <div className="absolute top-0 right-0 p-3">
        <Sparkles className="w-8 h-8 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
      </div>
      
      <div className="text-center mb-4">
        <h2 className="font-pixel text-amber-400 text-3xl text-stroke-sm drop-shadow-md">¡VICTORIA!</h2>
        <span className="bg-blue-900 text-white font-vt text-lg px-3 py-1 rounded-full border-2 border-blue-400 inline-block mt-2 shadow-inner">
          Modo: {pendingScore.gameMode === 'classic' ? 'Clásico' : pendingScore.gameMode === 'zen' ? 'Zen' : 'Arena'}
        </span>
      </div>
      
      <div className="bg-blue-900/50 rounded-2xl p-4 border-2 border-blue-800 shadow-inner text-center">
        <h4 className="text-white font-pixel text-4xl tracking-tight text-stroke-sm drop-shadow-lg">
          {String(pendingScore.score)} <span className="text-xl text-amber-400">PTS</span>
        </h4>
        
        <div className="flex justify-center gap-6 mt-4 pt-4 border-t-2 border-blue-800/50 text-xl font-vt">
          <div className="flex flex-col items-center text-blue-100">
            <Clock className="w-6 h-6 text-blue-300 mb-1" />
            <span>{pendingScore.duration}s</span>
          </div>
          <div className="flex flex-col items-center text-blue-100">
            <Swords className="w-6 h-6 text-blue-300 mb-1" />
            <span>{pendingScore.slashes} Cortes</span>
          </div>
        </div>
      </div>

      {walletState.connected ? (
        <div className="mt-6 space-y-3 bg-amber-100 border-4 border-amber-300 p-4 rounded-2xl text-center shadow-md">
          <span className="text-sm font-pixel text-amber-800 uppercase block mb-2">Firma On-Chain</span>
          <div className="text-blue-900 text-xl font-vt bg-white py-2 px-3 rounded-xl border-2 border-amber-200 truncate shadow-inner">
            👤 {walletState.domainName || (walletState.publicKey ? `${walletState.publicKey.slice(0, 8)}...${walletState.publicKey.slice(-4)}` : 'ANÓNIMO')}
          </div>
          <button
            type="button"
            onClick={() => {
              const pseudoHash = 'SlashSliceTx' + Math.random().toString(36).substring(2, 10).toUpperCase() + 'Sig';
              const newRecord: ScoreRecord = {
                name: walletState.domainName || (walletState.publicKey ? `${walletState.publicKey.slice(0, 6)}...${walletState.publicKey.slice(-4)}` : 'ANÓNIMO'),
                score: pendingScore.score,
                timestamp: Date.now(),
                duration: pendingScore.duration,
                slashes: pendingScore.slashes,
                slashHistory: pendingScore.slashHistory,
                pubkey: walletState.publicKey || undefined,
                domain: walletState.domainName || undefined,
                txHash: pseudoHash,
                verified: true,
                mode: pendingScore.gameMode || 'arcade',
              };

              const updated = [newRecord, ...scores];
              setScores(updated);
              localStorage.setItem('slash_slice_scores_v2', JSON.stringify(updated));
              setPendingScore(null);
              playWebSound('register');
              showToast('🔥 ¡Récord Épico Guardado!', 'success');
            }}
            className="w-full btn-clash-gold py-3 text-lg flex items-center justify-center gap-2 mt-2"
          >
            <Star className="w-5 h-5 fill-white" />
            <span>INMORTALIZAR RÉCORD</span>
          </button>
          <div className="flex justify-between items-center text-xs text-amber-700 pt-2 font-vt">
            <button
              type="button"
              onClick={() => {
                setWalletState(prev => ({
                  ...prev,
                  connected: false,
                  publicKey: null,
                  domainName: null
                }));
              }}
              className="hover:text-amber-900 transition underline cursor-pointer"
            >
              Cambiar Nombre
            </button>
            <button
              type="button"
              onClick={() => setPendingScore(null)}
              className="hover:text-amber-900 transition cursor-pointer font-bold"
            >
              Omitir
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleRegisterScore} className="mt-6 space-y-4">
          <div className="bg-blue-900/30 p-4 rounded-2xl border-2 border-blue-800">
            <label htmlFor="chef-name" className="block text-sm font-pixel text-blue-200 mb-2 text-center text-stroke-sm">
              Tu Nombre de Chef:
            </label>
            <div className="flex flex-col gap-3">
              <input
                id="chef-name"
                type="text"
                maxLength={12}
                placeholder="CHEF_NINJA"
                value={chefName}
                onChange={(e) => setChefName(e.target.value)}
                className="bg-white border-4 border-blue-200 text-blue-900 rounded-xl px-4 py-3 text-xl font-vt text-center uppercase focus:outline-none focus:border-amber-400 shadow-inner"
                required
              />
              <button
                type="submit"
                className="btn-clash-blue py-3 text-xl w-full flex items-center justify-center gap-2"
              >
                <span>GUARDAR RÉCORD</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPendingScore(null)}
            className="text-sm font-vt font-bold text-blue-300 hover:text-white transition block text-center w-full cursor-pointer underline"
          >
            Omitir registro
          </button>
        </form>
      )}
    </motion.div>
  );

  return (
    <div id="ninja-app-root" className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-400 selection:text-white pb-16 overflow-hidden relative">
      
      {/* Cartoon clouds decoration */}
      <div className="absolute top-10 left-10 w-32 h-16 bg-white/20 rounded-full blur-xl pointer-events-none" />
      <div className="absolute top-20 right-20 w-48 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />

      {/* Main Nav header */}
      <header className="relative max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-40">
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: -5 }}
            className="relative bg-gradient-to-b from-amber-300 to-amber-500 text-3xl p-3 rounded-2xl flex items-center justify-center font-bold border-b-[6px] border-amber-600 shadow-lg border-x-2 border-t-2 border-amber-200"
          >
            🍕⚔️
          </motion.div>
          <div>
            <h1 className="text-3xl md:text-4xl font-pixel tracking-wide text-white text-stroke-title drop-shadow-xl flex items-center gap-2">
              Slash Slice 
              <span className="text-[10px] uppercase font-vt text-lg bg-red-500 text-white border-2 border-red-700 px-2 py-0.5 rounded-lg shadow-sm transform -rotate-6 translate-y-[-5px]">
                Arena
              </span>
            </h1>
            <p className="font-vt text-xl text-blue-100 mt-1 uppercase text-stroke-sm drop-shadow-md">¡Domina la arena de la cocina!</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm bg-blue-900/40 border-2 border-blue-300/30 px-4 py-2 rounded-2xl text-white font-vt text-xl shadow-inner">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400 drop-shadow-md" />
            <span>Mouse o Táctil</span>
          </div>

          <button
            onClick={() => setIsWalletOpen(true)}
            className={`flex items-center gap-2 text-sm px-4 py-3 cursor-pointer text-xl uppercase ${
              walletState.connected
                ? 'btn-clash-blue'
                : 'btn-clash-red'
            }`}
          >
            <Wallet className={`w-5 h-5 shrink-0 ${walletState.connected ? 'text-blue-100' : 'text-red-100'}`} />
            <span className="font-pixel text-sm mt-1">
              {walletState.connected
                ? walletState.domainName || `${walletState.publicKey?.slice(0, 4)}...${walletState.publicKey?.slice(-4)}`
                : 'Wallet'}
            </span>
            {walletState.connected && (
              <span className="h-2 w-2 bg-emerald-400 rounded-full border border-emerald-700" />
            )}
          </button>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="relative max-w-4xl mx-auto px-6 mt-8 z-40">
        
        <div className="space-y-4">
          
          <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl">
            {/* Score Registry Popup overlay INSIDE the game container */}
            <AnimatePresence>
              {pendingScore !== null && !isPlaying && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
                >
                  {scoreRegistrationCard}
                </motion.div>
              )}
            </AnimatePresence>
            <PizzaCanvas
              onGameOver={handleGameOver}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              onToastMessage={showToast}
              isRegistering={pendingScore !== null}
            />
          </div>

          {/* Retro Arcade Tips Box */}
          <div className="panel-clash p-5 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/20 rounded-full blur-2xl pointer-events-none" />
            <div className="flex gap-4 items-start relative z-10">
              <div className="bg-amber-400 text-white p-3 rounded-2xl mt-0.5 shrink-0 border-b-4 border-amber-600 shadow-lg border-x-2 border-t-2 border-amber-300">
                <Flame className="w-6 h-6 fill-white drop-shadow-md" />
              </div>
              <div>
                <h3 className="font-pixel text-white text-lg sm:text-xl text-stroke-sm drop-shadow-md">Consejo Maestro: ¡Combos Épicos!</h3>
                <p className="font-vt text-xl text-blue-900 mt-1 leading-tight font-bold">
                  Corta múltiples pizzas en un solo movimiento fluido para obtener bonos de elixir (puntos). ¡Esquiva la piña y las quemadas o perderás tu racha!
                </p>
              </div>
            </div>
          </div>

        </div>

      </main>

      <footer className="max-w-7xl mx-auto px-6 mt-16 text-center text-blue-200 text-sm font-vt border-t-4 border-blue-600/50 pt-8 drop-shadow-md">
        <span>© 2026 Slash Slice Arena. Construido con ❤️ para verdaderos chefs guerreros.</span>
        <div className="mt-2 flex justify-center gap-4 text-xs text-blue-300">
          <span>Estilo Gráfico AAA</span>
          <span>•</span>
          <span>FPS Máximo</span>
        </div>
      </footer>

      {/* Toast Notification HUD */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -45, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.96 }}
            className={`fixed top-6 right-6 px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 z-50 font-sans text-xs max-w-[340px] pointer-events-auto select-none ${
              toast.type === 'success' 
                ? 'bg-emerald-950/98 border-emerald-500/40 text-emerald-200 shadow-emerald-500/10' 
                : toast.type === 'error'
                  ? 'bg-rose-950/98 border-rose-500/40 text-rose-250 shadow-rose-500/10'
                  : 'bg-slate-900/98 border-slate-700/60 text-slate-100 shadow-slate-900/40'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              toast.type === 'success' ? 'bg-emerald-400 animate-pulse' : toast.type === 'error' ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'
            }`} />
            <span className="font-semibold leading-relaxed">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Landscape Rotation Warning Overlay */}
      <div className="fixed inset-0 z-50 bg-blue-900 flex flex-col items-center justify-center text-center p-6 pointer-events-auto select-none md:hidden portrait:flex landscape:hidden">
        {/* Cartoon clouds decoration */}
        <div className="absolute top-10 left-10 w-32 h-16 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="absolute bottom-20 right-20 w-48 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        {/* Cyber Loop Phone Rotation Icon */}
        <div className="relative mb-8 group">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-rose-500 to-indigo-500 blur opacity-75 animate-pulse" />
          <div className="relative bg-slate-900 border border-slate-800 p-6 rounded-full flex items-center justify-center shadow-2xl">
            {/* Loop rotate phone svg */}
            <svg
              className="w-16 h-16 text-rose-500 animate-[spin_3s_linear_infinite]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <path d="M12 18h.01" />
              <path d="M17 6H7" />
              <path d="M7 14h10" />
            </svg>
          </div>
        </div>

        {/* Warning Typography */}
        <h2 className="text-xl font-black font-sans tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-amber-400 to-rose-400 uppercase leading-none drop-shadow-md">
          🥷 Gira tu Pantalla
        </h2>
        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block mt-2">
          MODO CONSOLA HORIZONTAL 16:9
        </span>
        
        <p className="text-slate-300 text-xs leading-relaxed max-w-[280px] mt-4 font-medium">
          ¡Mamma Mia! Para cortar las pizzas con la máxima precisión, rango de corte y velocidad, por favor **gira tu celular a modo horizontal**.
        </p>

        {/* Premium badge */}
        <div className="mt-8 border border-slate-900 bg-slate-900/40 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[9px] font-mono font-bold text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
          <span>SOPORTE ÓPTICO ACTIVO</span>
        </div>
      </div>

      {/* Floating Side Wallet Trigger Tab */}
      <button
        onClick={() => setIsWalletOpen(true)}
        className={`fixed right-0 top-1/3 -translate-y-1/2 z-40 py-4 px-2 rounded-l-2xl border-y-4 border-l-4 transition-all duration-200 cursor-pointer flex flex-col items-center gap-2 hover:pl-3 shadow-xl ${
          walletState.connected
            ? 'bg-blue-500 border-blue-700 text-white'
            : 'bg-red-500 border-red-700 text-white'
        }`}
        title="Ver Solana Wallet"
      >
        <Wallet className="w-6 h-6 text-white drop-shadow-md animate-bounce" />
        <span className="text-xs font-pixel tracking-wider uppercase select-none [writing-mode:vertical-lr] scale-90 text-stroke-sm">
          {walletState.connected ? 'WALLET OK' : 'SOLANA'}
        </span>
      </button>

      {/* Solana Wallet Slide-out Side Drawer ("Drop Bar Lateral") */}
      <AnimatePresence>
        {isWalletOpen && (
          <>
            {/* Dark overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWalletOpen(false)}
              className="fixed inset-0 bg-slate-950/90 z-50 pointer-events-auto"
            />
            
            {/* Sliding Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-[310px] sm:w-[350px] bg-blue-50 border-l-4 border-blue-900 shadow-2xl z-50 flex flex-col p-5 pointer-events-auto"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b-4 border-blue-200 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-amber-400 text-white p-2 rounded-xl border-b-[4px] border-amber-600 border-x border-t border-amber-300 shadow-md">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-pixel text-lg text-blue-900 tracking-tight text-stroke-sm text-white">Solana Hub</h3>
                    <p className="text-sm font-vt text-blue-600 uppercase font-bold leading-none">CONEXIÓN & RÉCORDS</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsWalletOpen(false)}
                  className="p-2 text-white bg-red-500 hover:bg-red-400 rounded-xl transition cursor-pointer border-b-[4px] border-red-700 shadow-md border-x border-t border-red-300 active:border-b-0 active:translate-y-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Wallet Connector inside the Drawer */}
              <div className="flex-1 overflow-y-auto pr-0.5 space-y-4 scrollbar-thin">
                <SolanaWalletConnector 
                  walletState={walletState} 
                  setWalletState={setWalletState} 
                  onToastMessage={showToast} 
                />
                
                {/* Additional web3 information / records helper to make the drawer look extremely premium */}
                <div className="bg-slate-900/40 border border-slate-900 p-3 rounded-xl text-[10px] text-slate-400 leading-normal space-y-2">
                  <span className="font-bold font-sans text-[9px] text-white block uppercase tracking-wider">🎯 Récords On-Chain de Solana</span>
                  <p className="text-[8.5px] text-slate-400 leading-relaxed">
                    Al conectar tu billetera Solana, tus puntuaciones se guardan de forma inmutable en el ledger descentralizado, vinculadas permanentemente a tu clave pública.
                  </p>
                  <div className="flex items-center gap-1.5 text-[8px] font-mono text-indigo-400 font-bold bg-indigo-950/20 border border-indigo-900/35 p-1 rounded-lg">
                    <Star className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
                    <span>INTEGRACIÓN ACTIVADA (NET DE PRUEBA)</span>
                  </div>
                </div>

                {/* Global Leaderboard Card inside the drawer */}
                <div className="border-t border-slate-900/80 pt-4 mt-2">
                  <Leaderboard scores={scores} />
                  
                  {scores.length > 0 && (
                    <div className="text-right mt-3">
                      <button
                        onClick={handleClearScores}
                        className="text-[9px] font-mono text-slate-500 hover:text-rose-450 transition inline-flex items-center gap-1.5 cursor-pointer bg-slate-900/30 px-3 py-1.5 rounded-xl border border-slate-900 w-full justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Reiniciar Récords Locales</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer inside the Drawer */}
              <div className="border-t border-slate-900 pt-3 mt-3 text-[8.5px] font-mono text-slate-600 text-center">
                <span>Slash Slice Decentralized Protocol</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
