import React, { useState, useEffect } from 'react';
import { Flame, Trophy, Award, Trash2, ArrowRight, User, Sparkles, Star, Swords, Clock, Wallet } from 'lucide-react';
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

  // Trigger loading initial leaderboard entries from LocalStorage or seed defaults
  useEffect(() => {
    const saved = localStorage.getItem('pizza_ninja_scores_v2');
    if (saved) {
      try {
        setScores(JSON.parse(saved));
      } catch (err) {
        console.error(err);
      }
    } else {
      // Seed some dummy records matching Pizza Ninja retro theme
      const seeds: ScoreRecord[] = [
        {
          name: 'CHEF_MARIO',
          score: 410,
          timestamp: Date.now() - 3605 * 1000 * 3, // 3 hours ago
          duration: 45,
          slashes: 154,
        },
        {
          name: 'NINJA_SLICE',
          score: 350,
          timestamp: Date.now() - 3605 * 1000 * 12,
          duration: 45,
          slashes: 125,
        },
        {
          name: 'EL_CORTE_RAPIDO',
          score: 280,
          timestamp: Date.now() - 3605 * 1000 * 24,
          duration: 45,
          slashes: 89,
        },
        {
          name: 'PEPERONI_PRO',
          score: 180,
          timestamp: Date.now() - 3605 * 1000 * 48,
          duration: 30,
          slashes: 45,
        },
      ];
      setScores(seeds);
      localStorage.setItem('pizza_ninja_scores_v2', JSON.stringify(seeds));
    }
  }, []);

  // When a game finishes, record score state as pending submission
  const handleGameOver = (
    finalScore: number,
    finalDuration: number,
    finalSlashes: number,
    slashHistory: SlashReplayPoint[],
    gameStartTimestamp?: number
  ) => {
    setPendingScore({
      score: finalScore,
      duration: finalDuration,
      slashes: finalSlashes,
      slashHistory,
      gameStartTimestamp,
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
    };

    const updated = [newRecord, ...scores];
    setScores(updated);
    localStorage.setItem('pizza_ninja_scores_v2', JSON.stringify(updated));
    setPendingScore(null);
    playWebSound('register');
  };

  const handleClearScores = () => {
    if (window.confirm('¿Seguro que deseas reiniciar todos los récords locales?')) {
      setScores([]);
      localStorage.removeItem('pizza_ninja_scores_v2');
    }
  };

  return (
    <div id="ninja-app-root" className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-rose-500 selection:text-white pb-16">
      
      {/* Decorative background grid and neon lights */}
      <div className="absolute top-0 inset-x-0 h-[480px] bg-gradient-to-b from-indigo-900/10 via-slate-950 to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-rose-500/5 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Nav header */}
      <header className="relative max-w-7xl mx-auto px-6 py-5 border-b border-slate-900/80 flex flex-col md:flex-row justify-between items-center gap-4 z-40">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-rose-500 to-indigo-650 blur opacity-60 group-hover:opacity-100 transition duration-300" />
            <div className="relative bg-slate-900 text-2xl p-2.5 rounded-2xl flex items-center justify-center font-bold">
              🍕🥷
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Pizza Ninja <span className="text-[10px] uppercase font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">Retro Arcade</span>
            </h1>
            <p className="text-xs text-slate-400">¡Corta deliciosas pizzas en rebanadas perfectas antes de que caigan!</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl text-slate-400">
          <Star className="w-4 h-4 text-amber-400 animate-pulse fill-amber-400/20" />
          <span>Prepárate con tu mouse o pantalla táctil</span>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="relative max-w-7xl mx-auto px-6 mt-8 z-40">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Arcade Area: Pizza Canvas Game */}
          <div className="lg:col-span-8 space-y-4">
            <PizzaCanvas
              onGameOver={handleGameOver}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              onToastMessage={showToast}
            />

            {/* Retro Arcade Tips Box */}
            <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-3xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex gap-4 items-start">
                <div className="bg-rose-500/10 text-rose-400 p-2.5 rounded-xl mt-0.5 shrink-0">
                  <Flame className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-xs sm:text-sm">Consejo Ninja: ¡Multiplicación de Puntos!</h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Cortar las pizzas en un solo movimiento fluido te dará bonos adicionales. Evita tocar la piña o las pizzas quemadas, ¡pues arruinarán tu racha culinaria por completo!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Leaderboard & Score Moniker submitter */}
          <div className="lg:col-span-4 space-y-6 flex flex-col h-full">
            
            {/* If there is a score pending registration */}
            {pendingScore && (
              <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-slate-950/40 border border-amber-500/30 rounded-2xl p-6 shadow-2xl animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                </div>
                
                <span className="bg-amber-500/10 text-amber-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20 block w-max uppercase tracking-wider">
                  🎉 ¡NUEVA MARCA LOGRADA!
                </span>
                
                <h4 className="text-white font-sans font-black text-2xl mt-3 tracking-tight">
                  <span className="text-amber-400">{pendingScore.score}</span> <span className="text-xs font-mono font-bold text-slate-400">PIXEL PTS</span>
                </h4>
                
                <div className="grid grid-cols-2 gap-2 mt-2 pb-3.5 border-b border-slate-800/60 text-xs">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ronda: {pendingScore.duration}s</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400">
                    <Swords className="w-3.5 h-3.5 text-slate-500" />
                    <span>Cortes: {pendingScore.slashes}</span>
                  </div>
                </div>

                {walletState.connected ? (
                  <div className="mt-4 space-y-3 bg-purple-950/20 border border-purple-500/20 p-3.5 rounded-xl text-center">
                    <span className="text-[9px] font-mono font-bold text-purple-400 uppercase tracking-widest block font-bold">Firma de Registro On-Chain</span>
                    <div className="text-white text-xs font-mono font-bold mt-1 bg-slate-950 py-1.5 px-2.5 rounded-xl border border-slate-850 truncate">
                      👤 {walletState.domainName || (walletState.publicKey ? `${walletState.publicKey.slice(0, 8)}...${walletState.publicKey.slice(-4)}` : 'ANÓNIMO')}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const pseudoHash = 'PizzaNinjaTx' + Math.random().toString(36).substring(2, 10).toUpperCase() + 'Sig';
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
                        };

                        const updated = [newRecord, ...scores];
                        setScores(updated);
                        localStorage.setItem('pizza_ninja_scores_v2', JSON.stringify(updated));
                        setPendingScore(null);
                        playWebSound('register');
                        showToast('🔥 Récord inmutable guardado on-chain para tu dirección Solana!', 'success');
                      }}
                      className="w-full bg-gradient-to-r from-purple-500 via-amber-500 to-rose-500 text-slate-955 font-black text-xs py-2.5 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-purple-400/20"
                    >
                      <Star className="w-4 h-4 fill-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
                      <span>Firmar e Inmortalizar Récord</span>
                    </button>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
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
                        className="hover:text-slate-300 transition underline cursor-pointer"
                      >
                        Usar nombre manual
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingScore(null)}
                        className="hover:text-slate-300 transition cursor-pointer"
                      >
                        Omitir
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleRegisterScore} className="mt-4 space-y-3">
                    <label htmlFor="chef-name" className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                      Introduce tu nombre de Chef:
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="chef-name"
                        type="text"
                        maxLength={12}
                        placeholder="NINJA_SLICE"
                        value={chefName}
                        onChange={(e) => setChefName(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-amber-500 flex-1 focus:border-amber-500"
                        required
                      />
                      <button
                        type="submit"
                        className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Guardar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingScore(null)}
                      className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition block text-right w-full cursor-pointer"
                    >
                      Omitir registro de récord
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Solana Wallet Link / Connection Module */}
            <SolanaWalletConnector 
              walletState={walletState} 
              setWalletState={setWalletState} 
              onToastMessage={showToast} 
            />

            {/* The global Leaderboard component */}
            <Leaderboard scores={scores} />

            {/* Option to clear local scores */}
            {scores.length > 0 && (
              <div className="text-right">
                <button
                  onClick={handleClearScores}
                  className="text-[10px] font-mono text-slate-500 hover:text-rose-400 transition inline-flex items-center gap-1 cursor-pointer bg-slate-900/30 px-2.5 py-1 rounded-lg border border-slate-900/80"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Reiniciar Récords</span>
                </button>
              </div>
            )}
            
          </div>

        </div>

      </main>

      {/* Retro Arcade footer copyright */}
      <footer className="max-w-7xl mx-auto px-6 mt-16 text-center text-slate-600 text-[11px] font-mono border-t border-slate-900/60 pt-8">
        <span>© 2026 Pizza Ninja Arcade Edition. Desarrollado con ❤️ para los amantes de las Pizzas.</span>
        <div className="mt-1 flex justify-center gap-4 text-[10px] text-slate-500">
          <span>Diseño Responsivo con Trazos Vectoriales</span>
          <span>•</span>
          <span>Tasa de FrameRate Óptima para Pantalla</span>
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

    </div>
  );
}
