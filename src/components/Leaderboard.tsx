import React, { useState, useRef, useEffect } from 'react';
import { Trophy, ShieldCheck, Flame, User, Calendar, ExternalLink, ChevronDown, ChevronUp, Clock, Swords, Play, Pause, RotateCcw } from 'lucide-react';
import { ScoreRecord, SlashReplayPoint } from '../types';
import { motion, AnimatePresence } from 'motion/react';

// Generates simulated/mock katana strikes for pre-seeded leaderboard scores so they are also replayable with epic flair
function generateMockSlashHistory(score: number): SlashReplayPoint[] {
  const history: SlashReplayPoint[] = [];
  const strokesCount = Math.min(8, Math.max(3, Math.floor(score / 35)));
  let timeCursor = 400;
  
  for (let i = 0; i < strokesCount; i++) {
    const strokeType = i % 4;
    const duration = 220; // ms per swipe
    const steps = 14;
    
    let startX = 0.5, startY = 0.5, endX = 0.5, endY = 0.5;
    
    if (strokeType === 0) {
      // Top-Left to Bottom-Right diagonal tajo
      startX = 0.15; startY = 0.2;
      endX = 0.85; endY = 0.8;
    } else if (strokeType === 1) {
      // Top-Right to Bottom-Left diagonal tajo
      startX = 0.85; startY = 0.18;
      endX = 0.15; endY = 0.82;
    } else if (strokeType === 2) {
      // Clean horizontal slash
      startX = 0.08; startY = 0.48;
      endX = 0.92; endY = 0.52;
    } else {
      // Curved crescent-moon slash
      startX = 0.2; startY = 0.75;
      endX = 0.8; endY = 0.65;
    }
    
    for (let step = 0; step <= steps; step++) {
      const pct = step / steps;
      const t = timeCursor + pct * duration;
      const isStart = step === 0;
      
      let x = startX + (endX - startX) * pct;
      let y = startY + (endY - startY) * pct;
      
      // Introduce an elegant bending arc to simulate dynamic sword physical swing
      if (strokeType === 3) {
        y -= Math.sin(pct * Math.PI) * 0.18;
      }
      
      history.push({ x, y, t, isStart });
    }
    
    timeCursor += duration + 380; // delay between combos
  }
  
  return history;
}

interface SlashReplayPlayerProps {
  score: number;
  duration?: number;
  slashes?: number;
  slashHistory?: SlashReplayPoint[];
}

export function SlashReplayPlayer({ score, duration, slashes, slashHistory }: SlashReplayPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playSpeed, setPlaySpeed] = useState(1.5); // Default fast-forward to respect user's time
  const [currentTimeText, setCurrentTimeText] = useState('0.0s');
  
  // Stabilize the points sequence so it doesn't recalculate
  const finalHistory = useRef<SlashReplayPoint[]>([]);
  
  useEffect(() => {
    if (slashHistory && slashHistory.length > 0) {
      finalHistory.current = slashHistory;
    } else {
      finalHistory.current = generateMockSlashHistory(score);
    }
  }, [slashHistory, score]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    let lastTime = Date.now();
    let playProgress = 0; // ms clock in active replay playback

    // Calculate duration cutoff
    const maxTime = finalHistory.current.length > 0 
      ? Math.max(...finalHistory.current.map(p => p.t))
      : 3000;

    const loop = () => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;

      if (isPlaying) {
        playProgress += delta * playSpeed;
        if (playProgress > maxTime + 600) {
          // Automatic looping reset with small delay
          playProgress = 0;
        }
      }

      const totalSecs = (maxTime / 1000).toFixed(1);
      const currSecs = (Math.min(maxTime, playProgress) / 1000).toFixed(1);
      setCurrentTimeText(`${currSecs}s / ${totalSecs}s`);

      // Draw high-fidelity telemetry tactical grid canvas
      ctx.fillStyle = '#020617'; // slate-950
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 1. Grid matrix overlays
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
      ctx.lineWidth = 1;
      const stepSize = 35;
      for (let i = stepSize; i < canvas.width; i += stepSize) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = stepSize; j < canvas.height; j += stepSize) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }

      // 2. Concentric tactical radar circles representing pizza zones
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.08)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.38, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.04)';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.18, 0, Math.PI * 2);
      ctx.stroke();

      // Filter recorded points up to current play progress
      const activePoints = finalHistory.current.filter(p => p.t <= playProgress);

      if (activePoints.length > 0) {
        // Group points into separated stroke paths using 'isStart' boundaries
        const strokes: SlashReplayPoint[][] = [];
        let currentStroke: SlashReplayPoint[] = [];

        for (const p of activePoints) {
          if (p.isStart) {
            if (currentStroke.length > 0) {
              strokes.push(currentStroke);
            }
            currentStroke = [p];
          } else {
            currentStroke.push(p);
          }
        }
        if (currentStroke.length > 0) {
          strokes.push(currentStroke);
        }

        // Draw each physical stroke
        strokes.forEach((stroke, sIdx) => {
          if (stroke.length < 2) return;

          // Compute a fade-off factor if the stroke is older than the current head position
          const lastPointInStroke = stroke[stroke.length - 1];
          const strokeAge = playProgress - lastPointInStroke.t;
          
          // Strokes older than 1.4 seconds get reduced opacity
          const opacity = Math.max(0.12, Math.min(1, 1 - (strokeAge - 600) / 800));

          // Draw thick neon pink lighting backdrop line for raw energy
          ctx.beginPath();
          ctx.strokeStyle = `rgba(244, 63, 94, ${0.16 * opacity})`;
          ctx.lineWidth = 7.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          stroke.forEach((pt, idx) => {
            const sx = pt.x * canvas.width;
            const sy = pt.y * canvas.height;
            if (idx === 0) {
              ctx.moveTo(sx, sy);
            } else {
              ctx.lineTo(sx, sy);
            }
          });
          ctx.stroke();

          // Draw highly visible neon orange-crimson core steel blade line
          ctx.beginPath();
          ctx.strokeStyle = sIdx % 2 === 0 ? `rgba(239, 68, 68, ${0.9 * opacity})` : `rgba(244, 63, 94, ${0.9 * opacity})`;
          ctx.lineWidth = 2.4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          stroke.forEach((pt, idx) => {
            const sx = pt.x * canvas.width;
            const sy = pt.y * canvas.height;
            if (idx === 0) {
              ctx.moveTo(sx, sy);
            } else {
              ctx.lineTo(sx, sy);
            }
          });
          ctx.stroke();

          // Draw sparkling strike particles at the bleeding edge of the cursor
          if (strokeAge < 250) {
            const tipPoint = stroke[stroke.length - 1];
            const tipX = tipPoint.x * canvas.width;
            const tipY = tipPoint.y * canvas.height;
            
            ctx.fillStyle = '#fed7aa'; // light orange pearl
            ctx.beginPath();
            ctx.arc(tipX, tipY, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Slicing wind ring glow
            ctx.strokeStyle = 'rgba(253, 186, 116, 0.45)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(tipX, tipY, 7, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
      }

      // Draw active telemetry status overlays
      ctx.fillStyle = 'rgba(100, 116, 139, 0.8)';
      ctx.font = '9px "JetBrains Mono", monospace';
      const slashStrikesNum = finalHistory.current.filter(p => p.t <= playProgress && p.isStart).length;
      ctx.fillText(`SWIPES: ${slashStrikesNum} / ${finalHistory.current.filter(p => p.isStart).length}`, 16, 22);

      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [isPlaying, playSpeed, finalHistory]);

  return (
    <div className="bg-slate-950/70 rounded-2xl border border-slate-800/80 p-3 flex flex-col gap-2.5 shadow-inner">
      {/* HUD Bar */}
      <div className="flex justify-between items-center bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800/50">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-bold">Replay de Trazos</span>
        </div>
        <span className="text-[10px] font-mono text-amber-500 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
          {currentTimeText}
        </span>
      </div>

      {/* Screen Canvas wrapper */}
      <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden border border-slate-900 shadow-lg">
        <canvas 
          ref={canvasRef}
          width={400}
          height={225}
          className="w-full h-full block bg-slate-950"
        />
        {/* Decorative corner reticles */}
        <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-slate-800 pointer-events-none" />
        <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-slate-800 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-slate-800 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-slate-800 pointer-events-none" />

        {/* Legend */}
        <div className="absolute bottom-2 left-2/2 text-[8px] font-mono bg-slate-950/90 text-slate-400 px-2 py-0.5 rounded border border-slate-900 pointer-events-none shadow">
          {slashHistory && slashHistory.length > 0 ? '📡 Registro Real On-Chain' : '🧠 Simulación de Cortes Maestros'}
        </div>
      </div>

      {/* Controls panel */}
      <div className="flex items-center justify-between gap-1 mt-0.5">
        <div className="flex gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:text-white transition-all text-[11px] font-mono uppercase font-bold cursor-pointer"
            type="button"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 text-rose-500" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/20" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              const canvas = canvasRef.current;
              if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
              }
              // Toggle isPlaying to trigger loop reset frame timing
              setIsPlaying(false);
              setTimeout(() => {
                setIsPlaying(true);
              }, 40);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-800 hover:text-slate-200 transition-all text-[11px] cursor-pointer"
            title="Reiniciar reproducción"
            type="button"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed selectors */}
        <div className="flex items-center bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800 gap-2">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold">VELOCIDAD:</span>
          <div className="flex gap-1.5 font-mono text-[9.5px]">
            {([1.0, 1.5, 2.5] as const).map((spd) => {
              const active = playSpeed === spd;
              return (
                <button
                  key={spd}
                  onClick={() => setPlaySpeed(spd)}
                  className={`px-1.5 py-0.5 rounded font-extrabold transition-all cursor-pointer ${
                    active 
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  type="button"
                >
                  {spd}x
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface LeaderboardProps {
  scores: ScoreRecord[];
}

export default function Leaderboard({ scores }: LeaderboardProps) {
  // Track currently expanded item index
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Track active mode tab selection
  const [activeTab, setActiveTab] = useState<'arcade' | 'classic'>('arcade');

  // Filter scores by active mode (fallback missing modes to 'arcade' default)
  const filteredScores = scores.filter(record => {
    const recordMode = record.mode || 'arcade';
    return recordMode === activeTab;
  });

  // Sort filtered scores primarily by points descending
  const sortedScores = [...filteredScores].sort((a, b) => b.score - a.score).slice(0, 10);

  const timeAgo = (timestamp: number) => {
    const secs = Math.floor((Date.now() - timestamp) / 1000);
    if (secs < 60) return 'Hace un momento';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `Hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `Hace ${hrs}h`;
  };

  return (
    <div id="ninja-leaderboard" className="w-full flex flex-col justify-between relative overflow-hidden bg-slate-950/80 rounded-2xl border border-slate-800/80 p-3 sm:p-5 shadow-2xl backdrop-blur-md">
      {/* Decorative ambient glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10 space-y-3 sm:space-y-4">
        {/* Header Title & Subtitle */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.35)] border border-amber-300/40 shrink-0">
              <Trophy className="w-5 h-5 text-slate-950 drop-shadow" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-pixel text-white tracking-wide uppercase flex items-center gap-2">
                <span>Récords de Arena</span>
                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-mono font-bold tracking-widest hidden sm:inline">
                  TOP 10
                </span>
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400 font-sans">
                Toca cualquier fila para ver la repetición del corte
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-xl font-mono text-[10px] text-amber-400 font-bold shrink-0">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>{scores.length} PARTIDAS</span>
          </div>
        </div>

        {/* Mode Selector Hidden (Classic mode disabled for current event) */}

        {/* Scoring table list */}
        <div className="space-y-2 max-h-[340px] sm:max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
          {sortedScores.length === 0 ? (
            <div className="text-center py-8 sm:py-12 border-2 border-slate-800 border-dashed rounded-2xl bg-slate-900/40">
              <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-slate-600 mx-auto mb-2 animate-bounce" />
              <p className="text-slate-300 font-pixel text-xs sm:text-sm uppercase tracking-wide">¡Sé el primero en conquistar el récord!</p>
              <span className="text-[10px] text-slate-500 font-sans block mt-1">Juega una partida para registrar tu marca aquí</span>
            </div>
          ) : (
            sortedScores.map((record, index) => {
              const itemRank = index + 1;
              const isTop3 = itemRank <= 3;
              const isExpanded = expandedIndex === index;
              
              const rankBadgeStyle = 
                itemRank === 1 ? 'bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 font-black border-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]' :
                itemRank === 2 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-950 font-black border-slate-100 shadow-[0_0_10px_rgba(203,213,225,0.4)]' :
                itemRank === 3 ? 'bg-gradient-to-br from-amber-700 to-amber-900 text-amber-100 font-black border-amber-600 shadow-[0_0_10px_rgba(180,83,9,0.3)]' :
                'bg-slate-800 text-slate-400 font-bold border-slate-700';

              const rankMedal = itemRank === 1 ? '🥇' : itemRank === 2 ? '🥈' : itemRank === 3 ? '🥉' : null;

              return (
                <div 
                  key={index} 
                  className={`flex flex-col rounded-xl border transition-all duration-200 relative overflow-hidden ${
                    isExpanded 
                      ? 'bg-slate-900/95 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                      : isTop3 
                        ? 'bg-slate-900/70 border-slate-700/80 hover:border-amber-500/50 hover:bg-slate-850' 
                        : 'bg-slate-950/60 border-slate-800/60 hover:border-slate-700 hover:bg-slate-900/50'
                  }`}
                >
                  {/* Clickable Header Row Area */}
                  <div 
                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
                    className="flex items-center justify-between p-2.5 sm:p-3 cursor-pointer select-none group/row gap-2"
                  >
                    {/* Rank badge & metadata details */}
                    <div className="flex items-center gap-2.5 sm:gap-3 z-10 min-w-0">
                      <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-[11px] sm:text-xs border ${rankBadgeStyle} shrink-0`}>
                        {rankMedal || itemRank}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-white font-mono font-bold tracking-wide truncate">
                          {record.pubkey ? (
                            <div className="flex items-center gap-1 truncate">
                              <span className="text-purple-400 font-black text-[10px] shrink-0" title="Cuenta Stellar Soroban">🚀</span>
                              <span className="text-cyan-400 font-black hover:text-cyan-300 truncate" title={record.pubkey}>
                                {record.domain || `${record.pubkey.slice(0, 6)}...${record.pubkey.slice(-4)}`}
                              </span>
                              <span className="bg-purple-500/20 text-[7px] text-purple-300 px-1 py-0.2 rounded border border-purple-500/30 font-sans tracking-wide uppercase font-black shrink-0">SOROBAN</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 truncate">
                              <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-slate-200 truncate">{record.name || 'CHEF_NINJA'}</span>
                            </div>
                          )}
                          {record.isSpicyCrust && (
                            <span
                              className="bg-amber-500/20 text-[7px] text-amber-300 px-1 py-0.2 rounded border border-amber-500/30 font-sans tracking-wide uppercase font-black shrink-0 flex items-center gap-0.5"
                              title="Puntaje verificado en SpicyCrust Central"
                            >
                              <span>🍕</span> SPICYCRUST
                            </span>
                          )}
                          {record.isDemo && (
                            <span
                              className="bg-slate-700/50 text-[7px] text-slate-400 px-1 py-0.2 rounded border border-slate-600 font-sans tracking-wide uppercase font-bold shrink-0"
                              title="Registro de demostración"
                            >
                              DEMO
                            </span>
                          )}
                        </div>
                        
                        {/* Subtitle record details */}
                        <div className="flex items-center gap-2 text-[9.5px] text-slate-500 mt-0.5 font-sans">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5 text-slate-600" />
                            {timeAgo(record.timestamp)}
                          </span>
                          {record.slashes !== undefined && (
                            <span className="hidden sm:inline text-slate-600">· {record.slashes} cortes</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score points display & action buttons */}
                    <div className="flex items-center gap-2 z-10 shrink-0">
                      <div className="text-right">
                        <span className="text-amber-400 text-xs sm:text-sm font-black font-mono tracking-tight drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                          {record.score.toLocaleString()}
                        </span>
                        <span className="text-[8px] text-slate-500 block uppercase font-mono leading-none">pts</span>
                      </div>
                      
                      {/* Expand Chevron affordance */}
                      <div className="text-slate-500 group-hover/row:text-amber-400 transition-colors pl-1">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-amber-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Parameters Block with dynamic layout */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden border-t border-slate-800 bg-slate-950/70"
                      >
                        <div className="p-3 sm:p-4 space-y-3 text-xs text-slate-300">
                          {/* Parameter grid values */}
                          <div className="grid grid-cols-3 gap-2 font-mono">
                            <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                              <Trophy className="w-3.5 h-3.5 text-amber-400 mb-0.5" />
                              <span className="text-[8px] text-slate-500 uppercase">PUNTOS</span>
                              <span className="text-xs font-black text-amber-400 mt-0.5">
                                {record.score.toLocaleString()}
                              </span>
                            </div>
                            <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                              <Clock className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
                              <span className="text-[8px] text-slate-500 uppercase">DURACIÓN</span>
                              <span className="text-xs font-black text-emerald-400 mt-0.5">
                                {record.duration !== undefined ? `${record.duration}s` : '45s'}
                              </span>
                            </div>
                            <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                              <Swords className="w-3.5 h-3.5 text-cyan-400 mb-0.5" />
                              <span className="text-[8px] text-slate-500 uppercase">CORTES</span>
                              <span className="text-xs font-black text-cyan-400 mt-0.5">
                                {record.slashes !== undefined ? record.slashes : '0'}
                              </span>
                            </div>
                          </div>

                          {/* Embedded interactive Slice Replay widget */}
                          <SlashReplayPlayer 
                            score={record.score} 
                            duration={record.duration} 
                            slashes={record.slashes}
                            slashHistory={record.slashHistory}
                          />

                          {/* Stellar Verification signature details */}
                          {record.pubkey && (
                            <div className="bg-indigo-950/30 border border-indigo-900/50 rounded-xl p-2.5 flex items-center justify-between text-[10px] font-mono">
                              <div className="flex items-center gap-2 text-indigo-300 min-w-0">
                                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest leading-none">Firma On-Chain</span>
                                  <span className="text-[9px] text-slate-300 leading-none mt-1 truncate" title={record.txHash || 'Soroban_Contract_Invoked'}>
                                    Tx: {record.txHash || 'Soroban_Contract_Invoked'}
                                  </span>
                                </div>
                              </div>
                              <a
                                href={`https://stellar.expert/explorer/testnet/account/${record.pubkey}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 rounded-lg px-2 py-1 text-[8px] font-bold text-indigo-300 transition-all flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                              >
                                <span>Ver Stellar</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
