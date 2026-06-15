import React, { useRef, useEffect, useState } from 'react';
import { Play, RotateCcw, Volume2, VolumeX, ShieldAlert, Zap, Flame, CalendarClock, Trophy, Music, Volume1, Maximize2, Minimize2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PizzaType, PizzaState, GameItem, Particle, SlicedPiece, TrailPoint, SlashReplayPoint } from '../types';
import HandTracker from './HandTracker';
import { gameSocket } from '../services/websocket';
import { connectFreighter, isFreighterInstalled } from '../services/stellarWallet';
import { getSpriteCache, drawCachedPizzaSlice } from '../graphics/PizzaSpriteCache';

export type GameMode = 'arcade' | 'classic';

interface PizzaCanvasProps {
  onGameOver: (score: number, duration: number, slashes: number, slashHistory: SlashReplayPoint[], gameStartTimestamp?: number, gameMode?: string) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  onToastMessage?: (message: string, type: 'success' | 'info' | 'error') => void;
  isRegistering?: boolean;
  walletPublicKey?: string | null;
  onOpenWallet?: () => void;
  activeBladeColor?: string;
}

export default function PizzaCanvas({ onGameOver, isPlaying, setIsPlaying, onToastMessage, isRegistering = false, walletPublicKey = null, onOpenWallet, activeBladeColor = '#ffffff' }: PizzaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastHandTrackedTimeRef = useRef<number[]>([0, 0]);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Mathematically rigorous, 100% numerically stable, critically damped 1D spring-damper.
   * Matches Unity's SmoothDamp algorithm. Frame-rate independent.
   */
  const smoothDamp = (
    current: number,
    target: number,
    velocityRef: { val: number },
    smoothTime: number, // Time in seconds to reach target (e.g., 0.07s)
    dt: number
  ): number => {
    smoothTime = Math.max(0.0001, smoothTime);
    const omega = 2.0 / smoothTime;

    const x = omega * dt;
    // Professional high-fidelity rational V8 approximation of e^(-x)
    const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = current - target;
    
    const temp = (velocityRef.val + omega * change) * dt;
    velocityRef.val = (velocityRef.val - omega * temp) * exp;
    let output = target + (change + temp) * exp;

    // Prevent overshoot
    if ((target - current > 0) === (output > target)) {
      output = target;
      velocityRef.val = 0;
    }

    return output;
  };
  
  // Game states in React for HUD (Only used for initial renders and game over logic)
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(45);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [controlMode, setControlMode] = useState<'mouse' | 'camera'>('mouse');
  
  const [gameMode, setGameMode] = useState<GameMode>(() => {
    const saved = localStorage.getItem('ninja_game_mode');
    return (saved === 'classic') ? saved : 'arcade';
  });

  const selectGameMode = (mode: GameMode) => {
    setGameMode(mode);
    localStorage.setItem('ninja_game_mode', mode);
    playWebSound('splat');
    onToastMessage?.(`Modo de juego: ${mode.toUpperCase()}`, 'success');
  };
  
  const [globalVolume, setGlobalVolume] = useState(() => {
    const saved = localStorage.getItem('ninja_global_volume');
    return saved !== null ? parseFloat(saved) : 0.6;
  });
  
  const [musicTheme, setMusicTheme] = useState<'italian' | 'synthwave'>(() => {
    const saved = localStorage.getItem('ninja_music_theme');
    return saved === 'synthwave' ? 'synthwave' : 'italian';
  });

  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [showFullConsole, setShowFullConsole] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [activeModal, setActiveModal] = useState<'knives' | 'rules' | 'settings' | null>(null);
  const [countdown, setCountdown] = useState<number | 'GO' | null>(null);
  const countdownActiveRef = useRef(false);
  const [performanceMode, setPerformanceMode] = useState(() => {
    const saved = localStorage.getItem('ninja_performance_mode');
    return saved === 'true';
  });

  const togglePerformanceMode = () => {
    setPerformanceMode(prev => {
      const newVal = !prev;
      localStorage.setItem('ninja_performance_mode', String(newVal));
      if (onToastMessage) {
        onToastMessage(
          newVal 
            ? 'Modo Rendimiento: Activado (Efectos reducidos para 60 FPS)' 
            : 'Modo Rendimiento: Desactivado (Efectos completos)',
          'info'
        );
      }
      return newVal;
    });
  };

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [walletPubKey, setWalletPubKey] = useState<string | null>(null);
  const [unlockedKnives, setUnlockedKnives] = useState<string[]>(['fire']); // Default

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFull);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!isFullscreen) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          await (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          await (container as any).msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
      onToastMessage?.("No se pudo alternar pantalla completa.", "error");
    }
  };


  const initiateCountdown = () => {
    if (countdownActiveRef.current) return;

    // Explicitly initialize/resume AudioContext on direct user click/touch gesture for maximum browser compatibility
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch (e) {
      console.warn("AudioContext unlock skip:", e);
    }

    countdownActiveRef.current = true;
    setCountdown(3);
    playWebSound('tick');

    let currentVal: number | 'GO' = 3;
    const intervalId = setInterval(() => {
      if (currentVal === 3) {
        currentVal = 2;
        setCountdown(2);
        playWebSound('tick');
      } else if (currentVal === 2) {
        currentVal = 1;
        setCountdown(1);
        playWebSound('tick');
      } else if (currentVal === 1) {
        currentVal = 'GO';
        setCountdown('GO');
        playWebSound('go');
      } else if (currentVal === 'GO') {
        clearInterval(intervalId);
        setCountdown(null);
        countdownActiveRef.current = false;
        startGame();
      }
    }, 800);
  };

  const updateHUD = () => {
    const scoreEl = document.getElementById('hud-score-display');
    if (scoreEl) scoreEl.innerText = String(stateRef.current.score);
    
    for (let i = 1; i <= 3; i++) {
      const lifeEl = document.getElementById('hud-life-' + i);
      if (lifeEl) {
        lifeEl.className = `transition-all duration-300 text-2xl ${stateRef.current.lives >= i ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'opacity-30 grayscale scale-75'}`;
      }
    }
    
    const comboContainerEl = document.getElementById('hud-combo-container');
    const comboMultEl = document.getElementById('hud-combo-multiplier');
    if (comboContainerEl) comboContainerEl.style.display = stateRef.current.ninjaCombo >= 2 ? 'flex' : 'none';
    if (comboMultEl) comboMultEl.innerText = 'x' + stateRef.current.comboMultiplier;
  };

  useEffect(() => {
    localStorage.setItem('ninja_global_volume', globalVolume.toString());
  }, [globalVolume]);

  useEffect(() => {
    localStorage.setItem('ninja_music_theme', musicTheme);
  }, [musicTheme]);

  const [gameDifficulty, setGameDifficulty] = useState(1);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [showComboAlert, setShowComboAlert] = useState(false);
  const [ninjaCombo, setNinjaCombo] = useState(1);

  const [damageFlash, setDamageFlash] = useState(false);

  const [arcadeDifficulty, setArcadeDifficulty] = useState<'casual' | 'pro' | 'ninja'>('pro');
  const arcadeDifficultyRef = useRef<'casual' | 'pro' | 'ninja'>('pro');

  useEffect(() => {
    arcadeDifficultyRef.current = arcadeDifficulty;
  }, [arcadeDifficulty]);

  const [bladeStyle, setBladeStyle] = useState<'fire' | 'cyber' | 'basil' | 'gold'>('fire');
  const bladeStyleRef = useRef<'fire' | 'cyber' | 'basil' | 'gold'>('fire');

  useEffect(() => {
    bladeStyleRef.current = bladeStyle;
  }, [bladeStyle]);

  const DIFFICULTY_SETTINGS = {
    casual: { speed: 0.8, spawn: 1.35, label: 'Casual 🟢' },
    pro: { speed: 1.0, spawn: 1.0, label: 'Pro ⚡' },
    ninja: { speed: 1.32, spawn: 0.65, label: 'Ninja 🔥' }
  };

  // Audio Context for sound effect synthesis (no external resources needed)
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Ambient Sound Ref engines for procedural "Italian Kitchen" sound loops
  const ambientGainRef = useRef<GainNode | null>(null);
  const ambientSourcesRef = useRef<{
    noiseSource: AudioBufferSourceNode | null;
    oscillatorNodes: OscillatorNode[];
    intervals: any[];
    activeChordOscs: OscillatorNode[];
  }>({
    noiseSource: null,
    oscillatorNodes: [],
    intervals: [],
    activeChordOscs: [],
  });

  // Low level mutable states for Canvas render loop (to avoid state delay and re-renders)
  const stateRef = useRef({
    score: 0,
    lives: 3,
    timeLeft: 45,
    gameMode: 'arcade' as GameMode,
    items: [] as GameItem[],
    particles: [] as Particle[],
    slicedPieces: [] as SlicedPiece[],
    trail: [] as TrailPoint[],
    trail1: [] as TrailPoint[],
    targetHandX: [0, 0] as number[],
    targetHandY: [0, 0] as number[],
    currentHandX: [undefined, undefined] as (number | undefined)[],
    currentHandY: [undefined, undefined] as (number | undefined)[],
    handVx: [0, 0] as number[],
    handVy: [0, 0] as number[],
    handLastUpdateTime: [0, 0] as number[],
    lastRawX: [undefined, undefined] as (number | undefined)[],
    lastRawY: [undefined, undefined] as (number | undefined)[],
    isMousePressed: false,
    lastX: 0,
    lastY: 0,
    lastX1: 0,
    lastY1: 0,
    totalSlashes: 0,
    elapsedTime: 0,
    lastSpawnTime: 0,
    lastTimeScaleUpdate: 0,
    nextId: 0,
    comboCount: 0,
    lastSliceTime: 0,
    comboTexts: [] as any[],
    lastSlashSoundTime: 0,
    startTime: 0,
    slashHistory: [] as SlashReplayPoint[],
    shakeDuration: 0,
    shakeIntensity: 0,
  });

  // Go Authoritative Server Integration
  const goServerConnectedRef = useRef(false);
  useEffect(() => {
    // Escuchar el servidor autoritativo
    const unsubscribe = gameSocket.subscribe((msg: any) => {
        if (msg.type === "TICK") {
            goServerConnectedRef.current = true;
            if (msg.gameState && msg.gameState.pizzas) {
                // Mapear pizzas del servidor al render local estético
                stateRef.current.items = Object.values(msg.gameState.pizzas).map((p: any) => ({
                    id: p.id,
                    x: p.x,
                    y: p.y,
                    vx: p.vx,
                    vy: p.vy,
                    rotation: p.rotation || 0,
                    rotationSpeed: p.vRotation || 0.05,
                    radius: 40,
                    type: PizzaType.Pepperoni,
                    state: p.sliced ? PizzaState.Half : PizzaState.Whole,
                    isBomb: false
                }));
            }
        } else if (msg.type === "INVENTORY_UPDATE") {
            if (msg.inventory && msg.inventory.unlockedKnives) {
                setUnlockedKnives(msg.inventory.unlockedKnives);
                
                // If they unlocked gold, auto-equip it to show off!
                if (msg.inventory.unlockedKnives.includes('gold')) {
                    setBladeStyle('gold');
                    onToastMessage?.("¡Has desbloqueado el Cuchillo del Capo!", "success");
                } else if (msg.inventory.unlockedKnives.includes('cyber')) {
                    setBladeStyle('cyber');
                    onToastMessage?.("¡Has desbloqueado el Cuchillo Cyber!", "success");
                }
            }
        }
    });

    return () => {
        unsubscribe();
    };
  }, [isPlaying]);

  const checkLineCircleCollision = (
    p1x: number, p1y: number, 
    p2x: number, p2y: number, 
    cx: number, cy: number, r: number
  ): number => {
    // Vector calculations to test if slicing segment intersects standard circle bounds
    const dx = p2x - p1x;
    const dy = p2y - p1y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return 0;

    // Projection mapping
    const u = ((cx - p1x) * dx + (cy - p1y) * dy) / (len * len);
    const clampedU = Math.min(Math.max(u, 0), 1);
    const closestX = p1x + clampedU * dx;
    const closestY = p1y + clampedU * dy;

    const distSq = (cx - closestX) * (cx - closestX) + (cy - closestY) * (cy - closestY);
    const isHit = distSq <= r * r;
    return isHit ? Math.max(1, len) : 0;
  };

  const addSplatParticles = (x: number, y: number, color: string, count: number, itemType?: PizzaType, speedMult = 1.0) => {
    if (performanceMode) {
      count = Math.max(2, Math.floor(count * 0.35));
    }
    // 100% vector particles representing juicy sauce, flour crumbs, and cheese. Zero lag.
    let particleColors = [color, '#fbcfe8', '#fef08a']; // sauce, crust, cheese mix
    if (itemType === PizzaType.Burnt) {
      particleColors = ['#18181b', '#3f3f46', '#27272a', '#ea580c']; // ash & fire amber
    } else if (itemType === PizzaType.Pineapple) {
      particleColors = ['#fde047', '#facc15', '#eab308']; // pineapple yellow drips
    }

    // If high speed, spawn dynamic impact shockwave glow rings!
    if (speedMult > 1.25 && !performanceMode) {
      const dColor = itemType === PizzaType.Burnt ? '#ea580c' : (itemType === PizzaType.Pineapple ? '#facc15' : color);
      const maxRadius = Math.min(110, 40 + speedMult * 12);
      
      // Background shockwave halo
      stateRef.current.particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        color: dColor,
        alpha: 1.0,
        size: 15,
        maxSize: maxRadius,
        gravity: 0,
        isGlow: true
      });

      // Dynamic intense flash core for rapid slashes
      if (speedMult > 1.95) {
        stateRef.current.particles.push({
          x,
          y,
          vx: 0,
          vy: 0,
          color: '#ffffff',
          alpha: 1.0,
          size: 8,
          maxSize: maxRadius * 0.55,
          gravity: 0,
          isGlow: true
        });
      }
    }

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 7 + 3) * speedMult;
      const itemColor = particleColors[Math.floor(Math.random() * particleColors.length)];
      
      stateRef.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: itemColor,
        alpha: 1.0,
        size: (Math.random() * 3 + 2) * Math.min(1.4, Math.sqrt(speedMult)), // crumbs scale with speed
        gravity: 0.16,
        isStain: itemColor === '#dc2626' && Math.random() < 0.15 // 15% chance for red sauce to be a splat stain!
      });
    }

    // Generate some special toppings particles with flying emojis
    if (itemType) {
      let toppingEmojis: string[] = [];
      if (itemType === PizzaType.Pepperoni) {
        toppingEmojis = ['🔴', '🧀', '🧅'];
      } else if (itemType === PizzaType.Veggie) {
        toppingEmojis = ['🍄', '🌿', '🫑', '🫒'];
      } else if (itemType === PizzaType.FourCheese) {
        toppingEmojis = ['🧀', '🥛', '✨'];
      } else if (itemType === PizzaType.Pineapple) {
        toppingEmojis = ['🍍', '💦'];
      } else if (itemType === PizzaType.Burnt) {
        toppingEmojis = ['🔥', '💨', '🪵'];
      }

      // Spawn 2 to 4 flying topping emojis
      const toppingsCount = Math.floor(Math.random() * 3) + 2;
      for (let t = 0; t < toppingsCount; t++) {
        const emoji = toppingEmojis[Math.floor(Math.random() * toppingEmojis.length)];
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 5 + 3.5) * speedMult;
        stateRef.current.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#ffffff',
          alpha: 1.0,
          size: Math.random() * 1.5 + 1.25, // scaling factor
          gravity: 0.15,
          emoji: emoji,
          isTopping: true
        });
      }
    }
  };

  // Sound generator
  const playWebSound = (type: 'slash' | 'splat' | 'error' | 'gameover' | 'tick' | 'go', comboFactor = 1) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Implement dynamic resonance filter (intensity) for high combos (>5) or splash intensity
      if (comboFactor > 5 && (type === 'slash' | 'splat')) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        // Sweep frequency upwards based on intensity
        const startFreq = type === 'slash' ? 450 + comboFactor * 25 : 300 + comboFactor * 30;
        const endFreq = type === 'slash' ? 1400 + comboFactor * 80 : 800 + comboFactor * 90;
        filter.frequency.setValueAtTime(startFreq, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + 0.2);
        
        // Increase Q (resonance factor) dynamically to make it sound sharp and sizzling
        const resonance = Math.min(15, comboFactor * 0.85);
        filter.Q.setValueAtTime(resonance, ctx.currentTime);

        // Chain oscillator through filter to gain
        osc.connect(filter);
        filter.connect(gainNode);
      } else {
        osc.connect(gainNode);
      }
      
      gainNode.connect(ctx.destination);

      if (type === 'slash') {
        osc.type = 'triangle';
        const slashFreqBase = 300 + (comboFactor > 5 ? (comboFactor - 5) * 40 : 0);
        osc.frequency.setValueAtTime(slashFreqBase, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000 + (comboFactor > 5 ? (comboFactor - 5) * 125 : 0), ctx.currentTime + 0.12);
        gainNode.gain.setValueAtTime(0.12 * globalVolume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * globalVolume, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'splat') {
        osc.type = 'sine';
        // Base frequency scales up dynamically based on the combo factor for high-hype feeling
        const baseFreq = 230 + Math.min(320, (comboFactor - 1) * 65) + (comboFactor > 5 ? (comboFactor - 5) * 60 : 0);
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(85, ctx.currentTime + 0.25);
        gainNode.gain.setValueAtTime(0.2 * globalVolume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * globalVolume, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, ctx.currentTime);
        osc.frequency.setValueAtTime(110, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.25 * globalVolume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * globalVolume, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.60);
        gainNode.gain.setValueAtTime(0.3 * globalVolume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * globalVolume, ctx.currentTime + 0.60);
        osc.start();
        osc.stop(ctx.currentTime + 0.60);
      } else if (type === 'tick') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.18 * globalVolume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * globalVolume, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'go') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3 * globalVolume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * globalVolume, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn('Web Audio no pudo reproducirse (interacción requerida):', e);
    }
  };

  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  const togglePause = (val: boolean) => {
    if (isPausedRef.current === val) return;
    setIsPaused(val);
    isPausedRef.current = val;
    if (val) {
      playWebSound('error');
    } else {
      playWebSound('splat');
    }
  };

  const startGame = () => {
    lastHandTrackedTimeRef.current = [Date.now(), Date.now()];
    isPausedRef.current = false;
    setIsPaused(false);
    // Reset mutable ref states -- PRESERVE camera hand tracking fields so hands
    // continue working immediately after game start without needing re-detection.
    // Previously this object was missing targetHandX/Y, handLastUpdateTime, etc.
    // causing the render loop's nowMs - undefined = NaN < 500 = false, making
    // the trail never build and hands unable to slice during gameplay.
    const prev = stateRef.current;
    stateRef.current = {
      score: 0,
      lives: 3,
      timeLeft: 45,
      gameMode: gameMode,
      items: [],
      particles: [],
      slicedPieces: [],
      trail: [],
      trail1: [],
      // Preserve live camera hand tracking across the game reset
      targetHandX: prev.targetHandX || [0, 0],
      targetHandY: prev.targetHandY || [0, 0],
      currentHandX: prev.currentHandX || [undefined, undefined],
      currentHandY: prev.currentHandY || [undefined, undefined],
      handVx: [0, 0],
      handVy: [0, 0],
      handLastUpdateTime: prev.handLastUpdateTime || [0, 0],
      lastRawX: prev.lastRawX || [undefined, undefined],
      lastRawY: prev.lastRawY || [undefined, undefined],
      isMousePressed: false,
      lastX: prev.lastX || 0,
      lastY: prev.lastY || 0,
      lastX1: prev.lastX1 || 0,
      lastY1: prev.lastY1 || 0,
      totalSlashes: 0,
      elapsedTime: 0,
      lastSpawnTime: 0,
      lastTimeScaleUpdate: 0,
      nextId: 1,
      comboCount: 0,
      lastSliceTime: 0,
      comboTexts: [],
      lastSlashSoundTime: 0,
      startTime: Date.now(),
      slashHistory: [],
      shakeDuration: 0,
      shakeIntensity: 0,
    };
    updateHUD();
    setElapsedTime(0);
    setGameDifficulty(1);
    setShowComboAlert(false);
    setIsPlaying(true);
    playWebSound('splat');
  };


  // Background Ambient Loops and procedural "Italian Kitchen" music/sizzle synthesis
  useEffect(() => {
    // If not playing or sound is disabled, clean up everything
    if (!isPlaying || !soundEnabled) {
      cleanupAmbient();
      return;
    }

    let ctx = audioCtxRef.current;
    if (!ctx) {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // 1. Create a Master Ambient Gain Node
    const masterAmbientGain = ctx.createGain();
    // Default starting volume based on current comboMultiplier, scaled by globalVolume
    const baseGain = (0.08 + Math.min(0.68, (comboMultiplier - 1) * 0.12)) * globalVolume;
    masterAmbientGain.gain.setValueAtTime(baseGain, ctx.currentTime);
    masterAmbientGain.connect(ctx.destination);
    ambientGainRef.current = masterAmbientGain;

    // 2. Generate cooking simmer pink-ish noise or sci-fi engine hum
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const channelData = noiseBuffer.getChannelData(0);
    // Fill with smooth butter-crackling noise values
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = 0.93 * lastOut + 0.07 * white;
      channelData[i] = lastOut * 0.35;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Filter to warm/deepen the asset
    const sizzleFilter = ctx.createBiquadFilter();
    sizzleFilter.type = 'lowpass';
    if (musicTheme === 'synthwave') {
      // Spaceship deep hum
      sizzleFilter.frequency.setValueAtTime(140, ctx.currentTime);
    } else {
      // Italian oven simmer sizzle
      sizzleFilter.frequency.setValueAtTime(650, ctx.currentTime);
    }
    sizzleFilter.Q.setValueAtTime(1.0, ctx.currentTime);

    // Dynamic shimmer/modulator logic to simulate flame movement or retro LFO pulse
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.35, ctx.currentTime); // 0.35 Hz soft waves
    if (musicTheme === 'synthwave') {
      lfoGain.gain.setValueAtTime(40, ctx.currentTime); // low drone vibrato
    } else {
      lfoGain.gain.setValueAtTime(180, ctx.currentTime); // high sizzle fluctuation
    }
    
    lfo.connect(lfoGain);
    lfoGain.connect(sizzleFilter.frequency);
    lfo.start();

    noiseSource.connect(sizzleFilter);
    sizzleFilter.connect(masterAmbientGain);
    noiseSource.start();

    ambientSourcesRef.current.noiseSource = noiseSource;
    ambientSourcesRef.current.oscillatorNodes.push(lfo);

    // 3. Periodic Tomato Sauce Bubbles or Space Grid blips
    const bubbleInterval = setInterval(() => {
      if (!ctx || ctx.state === 'suspended') return;
      if (Math.random() > (musicTheme === 'synthwave' ? 0.65 : 0.4)) return;

      const bubbleOsc = ctx.createOscillator();
      const bubbleGain = ctx.createGain();
      bubbleOsc.connect(bubbleGain);
      bubbleGain.connect(masterAmbientGain!);

      if (musicTheme === 'synthwave') {
        // Space blip sound
        bubbleOsc.type = 'sawtooth';
        const startFreq = 400 + Math.random() * 200;
        bubbleOsc.frequency.setValueAtTime(startFreq, ctx.currentTime);
        bubbleOsc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);

        const popVolume = 0.02 + Math.random() * 0.03;
        bubbleGain.gain.setValueAtTime(0, ctx.currentTime);
        bubbleGain.gain.linearRampToValueAtTime(popVolume, ctx.currentTime + 0.02);
        bubbleGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        bubbleOsc.start();
        bubbleOsc.stop(ctx.currentTime + 0.15);
      } else {
        // Classic boiling bubble
        bubbleOsc.type = 'sine';
        const startFreq = 85 + Math.random() * 95;
        bubbleOsc.frequency.setValueAtTime(startFreq, ctx.currentTime);
        bubbleOsc.frequency.exponentialRampToValueAtTime(startFreq * 2.2, ctx.currentTime + 0.12);

        const popVolume = 0.04 + Math.random() * 0.06;
        bubbleGain.gain.setValueAtTime(0, ctx.currentTime);
        bubbleGain.gain.linearRampToValueAtTime(popVolume, ctx.currentTime + 0.02);
        bubbleGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);

        bubbleOsc.start();
        bubbleOsc.stop(ctx.currentTime + 0.12);
      }
    }, musicTheme === 'synthwave' ? 360 : 280);

    // 4. Looping Music Chord Progression
    // Italian: happy upbeat tarantella (Am - E7 - Am - Dm - Am - E7 - Am)
    // Synthwave: deep retro majestic pads (Am - F - C - G)
    const italianChords = [
      [220.00, 261.63, 329.63], // Am
      [164.81, 246.94, 293.66, 329.63], // E7
      [220.00, 261.63, 329.63], // Am
      [146.83, 220.00, 293.66, 349.23], // Dm
      [220.00, 261.63, 329.63], // Am
      [164.81, 246.94, 293.66, 329.63], // E7
      [220.00, 261.63, 329.63], // Am
      [220.00, 261.63, 329.63]  // Am
    ];

    const synthwaveChords = [
      [110.00, 164.81, 220.00, 261.63, 329.63], // Am9
      [87.31, 130.81, 174.61, 220.00, 261.63],  // Fmaj7
      [130.81, 196.00, 261.63, 329.63, 392.00], // C
      [98.00, 146.83, 196.00, 246.94, 293.66]   // G6
    ];

    const currentChords = musicTheme === 'synthwave' ? synthwaveChords : italianChords;
    const chordDuration = musicTheme === 'synthwave' ? 3800 : 1200; // upbeat bouncy tempo for tarantella
    let currentChordIndex = 0;

    const playNextProgressionChord = () => {
      if (!ctx || ctx.state === 'suspended') return;
      
      // Stop previously playing chord oscillators to avoid overlap buildup
      ambientSourcesRef.current.activeChordOscs.forEach(osc => {
        try { osc.stop(); } catch (e) {}
      });
      ambientSourcesRef.current.activeChordOscs = [];

      const notes = currentChords[currentChordIndex];
      currentChordIndex = (currentChordIndex + 1) % currentChords.length;

      const chordGain = ctx.createGain();
      chordGain.connect(masterAmbientGain!);
      
      if (musicTheme === 'synthwave') {
        // Slow rising synth pad envelope
        chordGain.gain.setValueAtTime(0, ctx.currentTime);
        chordGain.gain.linearRampToValueAtTime(0.041, ctx.currentTime + 1.2);
        chordGain.gain.setValueAtTime(0.041, ctx.currentTime + 2.8);
        chordGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.7);

        const oscs = notes.map(freq => {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.detune.setValueAtTime((Math.random() - 0.5) * 22, ctx.currentTime);

          // Deep detune sweeping lowpass filter
          const lpFilter = ctx.createBiquadFilter();
          lpFilter.type = 'lowpass';
          lpFilter.frequency.setValueAtTime(220, ctx.currentTime);
          lpFilter.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 1.5);
          lpFilter.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 3.5);
          lpFilter.Q.setValueAtTime(1.5, ctx.currentTime);

          osc.connect(lpFilter);
          lpFilter.connect(chordGain);
          
          osc.start();
          return osc;
        });
        ambientSourcesRef.current.activeChordOscs = oscs;
      } else {
        // Upbeat tarantella accordion bouncing volume envelope
        chordGain.gain.setValueAtTime(0, ctx.currentTime);
        chordGain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.08); // fast snappy punch
        chordGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.1); // decay

        const oscs = notes.map(freq => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle'; // Accordion-like woodwind bellows
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.detune.setValueAtTime((Math.random() - 0.5) * 12, ctx.currentTime);

          const hpFilter = ctx.createBiquadFilter();
          hpFilter.type = 'bandpass';
          hpFilter.frequency.setValueAtTime(580, ctx.currentTime);
          hpFilter.Q.setValueAtTime(1.0, ctx.currentTime);

          osc.connect(hpFilter);
          hpFilter.connect(chordGain);
          
          osc.start();
          return osc;
        });
        ambientSourcesRef.current.activeChordOscs = oscs;
      }
    };

    // Play the first chord immediately
    playNextProgressionChord();
    
    // Cycle chords
    const chordInterval = setInterval(playNextProgressionChord, chordDuration);

    ambientSourcesRef.current.intervals.push(bubbleInterval);
    ambientSourcesRef.current.intervals.push(chordInterval);

    // Clean up on component unmount / theme modification
    function cleanupAmbient() {
      // Clear timers
      ambientSourcesRef.current.intervals.forEach(clearInterval);
      ambientSourcesRef.current.intervals = [];

      // Stop sources
      if (ambientSourcesRef.current.noiseSource) {
        try { ambientSourcesRef.current.noiseSource.stop(); } catch(e) {}
        ambientSourcesRef.current.noiseSource = null;
      }

      ambientSourcesRef.current.oscillatorNodes.forEach(osc => {
        try { osc.stop(); } catch(e) {}
      });
      ambientSourcesRef.current.oscillatorNodes = [];

      ambientSourcesRef.current.activeChordOscs.forEach(osc => {
        try { osc.stop(); } catch(e) {}
      });
      ambientSourcesRef.current.activeChordOscs = [];

      if (ambientGainRef.current) {
        try { ambientGainRef.current.disconnect(); } catch (e) {}
        ambientGainRef.current = null;
      }
    }

    return () => {
      cleanupAmbient();
    };
  }, [isPlaying, soundEnabled, musicTheme, globalVolume]);

  // Dynamically update ambient volume based on active combo multiplier
  useEffect(() => {
    if (!isPlaying || !soundEnabled || !ambientGainRef.current) return;
    
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Volume dynamically scales up with comboMultiplier and absolute global volume setting
    const targetVolume = (0.08 + Math.min(0.68, (comboMultiplier - 1) * 0.12)) * globalVolume;

    // Linear ramp over 250ms to prevent popping and sound smooth
    ambientGainRef.current.gain.linearRampToValueAtTime(targetVolume, ctx.currentTime + 0.25);
  }, [comboMultiplier, isPlaying, soundEnabled, globalVolume]);

  // Resizes canvas properly relative to coordinate frames
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        // Aggressive performance scaling for mobile/tablets: cap resolution to 1.0x to reduce GPU fill rate by 400%
        const isMobile = Math.min(window.innerWidth, window.innerHeight) < 768;
        const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2);
        let targetWidth = Math.round(parent.clientWidth * dpr);
        let targetHeight = Math.round((parent.clientHeight || 500) * dpr);
        
        // Capping maximum rasterized drawing buffer width for perfect 60 FPS fill-rate performance
        const maxBufferWidth = 1280; 
        if (targetWidth > maxBufferWidth) {
          const ratio = targetHeight / targetWidth;
          targetWidth = maxBufferWidth;
          targetHeight = Math.round(maxBufferWidth * ratio);
        }

        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Create observer to watch for dynamic widget expansions too
    const observer = new ResizeObserver(() => resizeCanvas());
    if (canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      observer.disconnect();
    };
  }, []);

  // Dedicated game countdown timer loop
  useEffect(() => {
    if (!isPlaying) return;

    const clockInterval = setInterval(() => {
      if (isPausedRef.current) return;
      
      if (stateRef.current.gameMode === 'arcade') {
        stateRef.current.timeLeft -= 1;
      }
      const currentSecs = stateRef.current.timeLeft;
      setTimeLeft(currentSecs);

      // Scale difficulty up slightly every 8 seconds based on elapsed time
      const elapsed = Math.floor((Date.now() - stateRef.current.startTime) / 1000);
      setElapsedTime(elapsed);
      const nextDiff = 1 + Math.floor(elapsed / 8) * 0.4;
      setGameDifficulty(parseFloat(nextDiff.toFixed(1)));

      const isGameOver = (stateRef.current.gameMode === 'arcade' && currentSecs <= 0) ||
                         (stateRef.current.gameMode === 'classic' && stateRef.current.lives <= 0) ||
                         (stateRef.current.lives <= 0);

      if (isGameOver) {
        clearInterval(clockInterval);
        setIsPlaying(false);
        playWebSound('gameover');
        
        // --- MULTIGAME INTEGRATION ---
        // Send score to Go Backend to save in Redis Vault and mint Ingredients
        if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
          gameSocket.send(JSON.stringify({
            type: 'SCORE_SUBMIT',
            pubKey: walletPubKey || 'G_GUEST_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            score: stateRef.current.score
          }));
        }
        
        onGameOver(
          stateRef.current.score, 
          elapsed, 
          stateRef.current.totalSlashes, 
          stateRef.current.slashHistory || [],
          stateRef.current.startTime,
          stateRef.current.gameMode
        );
      }
    }, 1000);

    return () => {
      clearInterval(clockInterval);
    };
  }, [isPlaying]);

  // Primary Gameplay physics and render loops
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Canvas now must render even when !isPlaying because the Start Pizza is drawn inside the canvas loop itself.
    let animationFrameId: number;

    // Get the prepared OffscreenCanvas instances for the game
    const cache = getSpriteCache();

    // Helper to draw a cached vector pizza sprite instantly (O(1) drawing instead of procedural layers)
    const drawPizzaVector = (
      itemCtx: CanvasRenderingContext2D,
      type: PizzaType,
      state: PizzaState,
      radius: number,
      rotation: number,
      cutsMade = 0
    ) => {
      itemCtx.save();
      itemCtx.rotate(rotation);

      const effectivePerformanceMode = performanceMode || controlMode === 'camera';
      
      if (!effectivePerformanceMode) {
        if (type === PizzaType.Golden) {
          itemCtx.shadowColor = '#f59e0b';
          itemCtx.shadowBlur = 20;
        } else if (type === PizzaType.Clock) {
          itemCtx.shadowColor = '#60a5fa';
          itemCtx.shadowBlur = 15;
        }
      }

      if (type === PizzaType.Pineapple && cache.pineappleWarning && !effectivePerformanceMode) {
         // Draw glow behind pineapple
         itemCtx.drawImage(cache.pineappleWarning, -radius * 1.15, -radius * 1.15, radius * 2.3, radius * 2.3);
      }

      let sprite;
      if (state === PizzaState.Half) {
        sprite = cache.half[type];
      } else {
        sprite = cutsMade > 0 ? cache.scarred[type] : cache.whole[type];
      }
      
      if (sprite) {
        itemCtx.drawImage(sprite, -radius, -radius, radius * 2, radius * 2);
      }
      
      if (!effectivePerformanceMode) {
        itemCtx.shadowBlur = 0; // reset
      }
      itemCtx.restore();
    };

    // Helper to draw clean fading wedge pieces using the sprite cache mask
    const drawPizzaSliceVector = (
      sliceCtx: CanvasRenderingContext2D,
      type: PizzaType,
      radius: number,
      startAngle: number,
      endAngle: number,
      alpha: number
    ) => {
      drawCachedPizzaSlice(sliceCtx, cache, type, radius, startAngle, endAngle, alpha);
    };

    const spawnGameItem = (width: number, height: number, diffScale: number) => {
      const id = stateRef.current.nextId++;
      
      const rand = Math.random();
      const adjustedRand = rand;
      let type = PizzaType.Pepperoni;
      let color = '#ef4444'; // default red
      let points = 10;
      let label = 'Pepperoni';

      if (adjustedRand < 0.28) {
        type = PizzaType.Pepperoni;
        color = '#ef4444';
        points = 10;
        label = 'Pepperoni';
      } else if (adjustedRand < 0.55) {
        type = PizzaType.Veggie;
        color = '#22c55e';
        points = 10;
        label = 'Vegetariana';
      } else if (adjustedRand < 0.70) {
        type = PizzaType.FourCheese;
        color = '#fbbf24';
        points = 10;
        label = 'Cuatro Quesos';
      } else if (adjustedRand < 0.85) {
        type = PizzaType.Pineapple;
        color = '#facc15';
        points = 5; // tiny warning points
        label = 'Piña';
      } else if (adjustedRand < 0.95) {
        type = PizzaType.Burnt;
        color = '#4b5563';
        points = 0;
        label = 'Pizza Quemada';
      } else if (adjustedRand < 0.98) {
        type = PizzaType.Golden;
        color = '#f59e0b'; // Amber-500
        points = 50; // Mass points
        label = 'Frenesí Dorado';
      } else {
        type = PizzaType.Clock;
        color = '#3b82f6'; // Blue-500
        points = 0; // Gives time instead
        label = 'Tiempo Extra';
      }

      // Launcher position and speed
      const isLeft = Math.random() > 0.5;
      const startX = isLeft 
        ? width * (0.05 + Math.random() * 0.15) 
        : width * (0.80 + Math.random() * 0.15);
      const startY = height + 50;
      
      // Non-linear (exponential) increase in physics speeds as timeLeft approaches 0
      const diffSetting = DIFFICULTY_SETTINGS[arcadeDifficultyRef.current];
      const speedFactor = diffSetting.speed;
      const expSpeedMult = (1.0 + (Math.exp(diffScale * 1.35) - 1) * 0.65) * speedFactor;

      // "Suban y bajen" logic strictly bounded by screen resolution (Mobile-safe)
      // Horizontal velocity proportional to width (arcs towards center slowly)
      const horizontalPush = width * (Math.random() * 0.0015 + 0.0015);
      const baseVx = isLeft ? horizontalPush : -horizontalPush;
      const vx = baseVx * expSpeedMult;
      
      // Vertical velocity precisely calculated using physics (h = v^2 / 2g) to keep them INSIDE the screen
      // We want max peak height to be 70% of screen height, and min peak to be 35%. Lower gravity for floaty fluidity.
      const minVyScale = 0.0132; // sqrt(2 * 0.00025 * 0.35)
      const maxVyScale = 0.0187; // sqrt(2 * 0.00025 * 0.70)
      const vyScale = minVyScale + Math.random() * (maxVyScale - minVyScale);
      
      // Añadimos un pequeño impulso base adicional (1.1x) para mayor sensación de fuerza inicial
      const vy = -(height * vyScale) * expSpeedMult * 1.1; 
      // Gravity scaled by height so pacing feels identical across all devices
      const gravity = (height * 0.00025) * expSpeedMult * expSpeedMult; 

      // Escala dinámica basada en la resolución, reducida en un 20% total según solicitud
      const scaleFactor = Math.max(1.0, width / 700); 
      const radius = ((Math.random() * 15 + 50) * 0.8) * scaleFactor;

      // Random state: complete pizzas or a la mitad!
      const state = Math.random() < 0.65 ? PizzaState.Whole : PizzaState.Half;

      stateRef.current.items.push({
        id,
        type,
        state,
        x: startX,
        y: startY,
        vx,
        vy,
        radius,
        isSliced: false,
        sliceAngle: 0,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.045 * expSpeedMult,
        color,
        points,
        label,
        gravity,
      });
    };

    const createSlicedSectors = (item: GameItem, sliceAngle: number) => {
      // Perfect final slice slicing! Semicircle is divided into 2 gourmet sector portions
      const sliceCount = 2;
      const angleStep = Math.PI / sliceCount;

      for (let i = 0; i < sliceCount; i++) {
        const startAngle = -Math.PI / 2 + i * angleStep;
        const endAngle = startAngle + angleStep;
        const midAngle = (startAngle + endAngle) / 2;

        const pushX = Math.cos(item.rotation + midAngle) * 7;
        const pushY = Math.sin(item.rotation + midAngle) * 7;

        stateRef.current.slicedPieces.push({
          id: stateRef.current.nextId++,
          type: item.type,
          x: item.x + pushX,
          y: item.y + pushY,
          vx: item.vx * 0.7 + Math.cos(item.rotation + midAngle) * 2.8 + (Math.random() - 0.5) * 1.5,
          vy: item.vy * 0.7 - 2 + Math.sin(item.rotation + midAngle) * 2.8,
          rotation: item.rotation,
          rotationSpeed: (Math.random() - 0.5) * 0.08,
          sliceAngle: item.rotation,
          radius: item.radius,
          startAngle,
          endAngle,
          alpha: 1.0,
          color: item.color,
          gravity: item.gravity,
        });
      }
    };

    // PERF: In camera mode, cap the game render loop to 30fps.
    // Hand tracking delivers at 20fps -- running the canvas at 60fps wastes ~50% CPU for no visual gain.
    // loopRunner is a stable reference used by updateLoop's self-scheduling rAF call.
    let lastRenderTs = performance.now();
    let loopRunner: () => void;

    // Main animation frame function with deltaTime scaling for ultra-fluid physics
    const updateLoop = (timeScale: number) => {
      if (!canvas || !ctx) return;
      const width = canvas.width;
      const height = canvas.height;
      // PERF: Camera mode or Mobile devices auto-enable performance optimizations
      const isMobileDevice = Math.min(window.innerWidth, window.innerHeight) < 768;
      const effectivePerformanceMode = performanceMode || controlMode === 'camera' || isMobileDevice;

      // Latency detection for hand tracking in camera mode
      // Only auto-pause if game has been running for at least 3s to prevent
      // immediate pause during game start before first hand frame arrives
      if (isPlaying && controlMode === 'camera') {
        const nowMs = Date.now();
        const lastTracked = Math.max(lastHandTrackedTimeRef.current[0], lastHandTrackedTimeRef.current[1]);
        const elapsed = nowMs - lastTracked;
        const gameRunningFor = nowMs - (stateRef.current.startTime || nowMs);

        // Only activate auto-pause if game has been active for 3+ seconds
        if (elapsed > 2000 && gameRunningFor > 3000) {
          if (!isPausedRef.current) {
            togglePause(true);
          }
        } else {
          // Auto-resume if coordinates are fresh and we were paused!
          if (isPausedRef.current && elapsed < 2000) {
            togglePause(false);
          }
        }
      }

      ctx.save();

      // 1. Transparent background (reveals wrapper bg or camera feed below)
      ctx.clearRect(0, 0, width, height);

      // If we want 2.5D, we can let GameScene3D cover the background and clear the 2D canvas transparently.
      // But since GameScene3D has a transparent background (no clear color), we need a background anyway!

      // 2. Spawn mechanism and combo logic (only active during gameplay)
      const now = Date.now();
      const isPaused = isPausedRef.current;

      if (isPlaying && !isPaused) {
        const diffScale = (45 - stateRef.current.timeLeft) / 45; // 0 to 1
        const baseSpawnInterval = Math.max(1200 - diffScale * 800, 400); // gets faster as game goes
        const diffSetting = DIFFICULTY_SETTINGS[arcadeDifficultyRef.current];
        const spawnInterval = baseSpawnInterval * diffSetting.spawn;

        // Decaying / resetting combo after 550ms has passed since the last satisfying slice!
        if (stateRef.current.comboCount > 1 && now - stateRef.current.lastSliceTime > 550) {
          stateRef.current.comboCount = 1;
          stateRef.current.comboMultiplier = 1;
          stateRef.current.ninjaCombo = 1;
          updateHUD();
          setShowComboAlert(false);
        }

        // Generar físicas locales
        if (true) {
          if (now - stateRef.current.lastSpawnTime > spawnInterval) {
            // Emit 1 to 3 items based on difficulty level
            const count = Math.random() < 0.35 ? 1 : Math.random() < 0.75 || diffScale < 0.4 ? 2 : 3;
            for (let s = 0; s < count; s++) {
              spawnGameItem(width, height, diffScale);
            }
            stateRef.current.lastSpawnTime = now;
          }
        }
      }

      // Interpolate MediaPipe hand coordinates to a silky-smooth 60 FPS in camera mode (runs in both menu and gameplay)
      if (controlMode === 'camera' && !isPaused) {
        const nowMs = Date.now();
        const dt = 0.01666 * timeScale; // Real delta timestep for spring stability
        const smoothTime = 0.07; // Snappy 70ms response time for zero perceived lag

        for (let handIdx = 0; handIdx < 2; handIdx++) {
          const lastUpdate = stateRef.current.handLastUpdateTime[handIdx];
          if (nowMs - lastUpdate < 500) {
            const targetX = stateRef.current.targetHandX[handIdx];
            const targetY = stateRef.current.targetHandY[handIdx];
            let curX = stateRef.current.currentHandX[handIdx];
            let curY = stateRef.current.currentHandY[handIdx];

            if (curX === undefined || curY === undefined) {
              curX = targetX;
              curY = targetY;
            } else {
              const vxRef = { val: handIdx === 0 ? stateRef.current.handVx[0] : stateRef.current.handVx[1] };
              const vyRef = { val: handIdx === 0 ? stateRef.current.handVy[0] : stateRef.current.handVy[1] };

              curX = smoothDamp(curX, targetX, vxRef, smoothTime, dt);
              curY = smoothDamp(curY, targetY, vyRef, smoothTime, dt);

              if (handIdx === 0) {
                stateRef.current.handVx[0] = vxRef.val;
                stateRef.current.handVy[0] = vyRef.val;
              } else {
                stateRef.current.handVx[1] = vxRef.val;
                stateRef.current.handVy[1] = vyRef.val;
              }
            }

            stateRef.current.currentHandX[handIdx] = curX;
            stateRef.current.currentHandY[handIdx] = curY;

            // Push the smooth critically damped coordinate into the visual trail on each frame
            if (curX > 0 && curY > 0) {
              // Allow longer visual trails. Max points before popping.
              const MAX_TRAIL = effectivePerformanceMode ? 25 : 45;
              if (handIdx === 0) {
                stateRef.current.trail.push({ x: curX, y: curY, age: 800 });
                if (stateRef.current.trail.length > MAX_TRAIL) stateRef.current.trail.shift();
              } else {
                stateRef.current.trail1.push({ x: curX, y: curY, age: 800 });
                if (stateRef.current.trail1.length > MAX_TRAIL) stateRef.current.trail1.shift();
              }
            }
          } else {
            // Clear current coords when hand goes out of view to snap instantly when re-acquired
            stateRef.current.currentHandX[handIdx] = undefined;
            stateRef.current.currentHandY[handIdx] = undefined;
          }
        }

        // Update visual cursor halo positions
        if (stateRef.current.currentHandX[0] !== undefined) {
          stateRef.current.lastX = stateRef.current.currentHandX[0];
          stateRef.current.lastY = stateRef.current.currentHandY[0];
        }
        if (stateRef.current.currentHandX[1] !== undefined) {
          stateRef.current.lastX1 = stateRef.current.currentHandX[1];
          stateRef.current.lastY1 = stateRef.current.currentHandY[1];
        }
      }

      // Update and Draw sword slash trails
      const trail = stateRef.current.trail;
      if (!isPaused) {
        let activeCount = 0;
        const hand0Active = controlMode === 'camera' && (Date.now() - lastHandTrackedTimeRef.current[0] < 500);
        for (let i = 0; i < trail.length; i++) {
          trail[i].age -= 16 * timeScale;
          if (trail[i].age > 0 || (hand0Active && i === trail.length - 1)) {
            trail[activeCount++] = trail[i];
          }
        }
        trail.length = activeCount;
      }

      const trail1 = stateRef.current.trail1;
      if (!isPaused) {
        let activeCount1 = 0;
        const hand1Active = controlMode === 'camera' && (Date.now() - lastHandTrackedTimeRef.current[1] < 500);
        for (let i = 0; i < trail1.length; i++) {
          trail1[i].age -= 16 * timeScale;
          if (trail1[i].age > 0 || (hand1Active && i === trail1.length - 1)) {
            trail1[activeCount1++] = trail1[i];
          }
        }
        trail1.length = activeCount1;
      }

      const activeTrail = stateRef.current.trail;
      const activeTrail1 = stateRef.current.trail1;

      // Draw trails for both hands
      [
        { activeTrail: activeTrail, isHand1: false },
        { activeTrail: activeTrail1, isHand1: true }
      ].forEach(({ activeTrail, isHand1 }) => {
        if (activeTrail.length > 1) {
          const style = bladeStyleRef.current;
          let sparkColor1 = '#fde047'; // yellow
          let sparkColor2 = '#ff5a23'; // red orange
          let trailColor1 = 'rgba(244, 63, 94, '; // PASS 1 background crimson
          let trailColor2 = 'rgba(249, 115, 22, '; // PASS 2 orange
          let trailColor3 = 'rgba(255, 255, 255, '; // PASS 3 core white

          if (style === 'cyber') {
            if (!isHand1) {
              sparkColor1 = '#38bdf8'; // neon cyan
              sparkColor2 = '#ec4899'; // neon pink
              trailColor1 = 'rgba(236, 72, 153, '; // pink
              trailColor2 = 'rgba(6, 182, 212, ';  // cyan
              trailColor3 = 'rgba(224, 242, 254, '; // pale cyan/white
            } else {
              sparkColor1 = '#d946ef'; // magenta/purple
              sparkColor2 = '#06b6d4'; // cyan
              trailColor1 = 'rgba(168, 85, 247, '; // neon purple/violet
              trailColor2 = 'rgba(6, 182, 212, ';  // neon cyan
              trailColor3 = 'rgba(224, 242, 254, '; // pale cyan/white
            }
          } else if (style === 'basil') {
            if (!isHand1) {
              sparkColor1 = '#a3e635'; // lime green
              sparkColor2 = '#22c55e'; // green
              trailColor1 = 'rgba(20, 83, 45, ';   // deep green
              trailColor2 = 'rgba(34, 197, 94, ';  // neon green
              trailColor3 = 'rgba(240, 253, 244, '; // pale mint green
            } else {
              sparkColor1 = '#f43f5e'; // rose
              sparkColor2 = '#fb7185'; // light pink
              trailColor1 = 'rgba(159, 18, 57, ';  // rose red
              trailColor2 = 'rgba(244, 63, 94, ';  // rose
              trailColor3 = 'rgba(255, 228, 230, '; // pale rose
            }
          } else if (style === 'gold') {
            if (!isHand1) {
              sparkColor1 = '#fbbf24'; // bright amber
              sparkColor2 = '#ffffff'; // white sparkles
              trailColor1 = 'rgba(146, 64, 14, ';  // bronze brown
              trailColor2 = 'rgba(234, 179, 8, ';  // gold
              trailColor3 = 'rgba(254, 249, 195, '; // golden yellow core
            } else {
              sparkColor1 = '#06b6d4'; // neon cyan
              sparkColor2 = '#38bdf8'; // sky blue
              trailColor1 = 'rgba(8, 51, 68, ';    // deep cyan
              trailColor2 = 'rgba(6, 182, 212, ';   // neon cyan
              trailColor3 = 'rgba(207, 250, 254, '; // pale cyan
            }
          } else { // classic
            if (!isHand1) {
              sparkColor1 = '#fde047'; // yellow
              sparkColor2 = '#ff5a23'; // red orange
              trailColor1 = 'rgba(244, 63, 94, '; // PASS 1 background crimson
              trailColor2 = 'rgba(249, 115, 22, '; // PASS 2 orange
              trailColor3 = 'rgba(255, 255, 255, '; // PASS 3 core white
            } else {
              sparkColor1 = '#06b6d4'; // cyan
              sparkColor2 = '#10b981'; // emerald green
              trailColor1 = 'rgba(6, 95, 70, ';    // deep emerald
              trailColor2 = 'rgba(16, 185, 129, ';  // neon green
              trailColor3 = 'rgba(209, 250, 229, '; // pale green
            }
          }

          // Draw fire-like hot particle sparks flying off the blade's leading cutting tip!
          const tipPoint = activeTrail[activeTrail.length - 1];
          const secondTipPoint = activeTrail[activeTrail.length - 2];
          const tipDist = Math.hypot(tipPoint.x - secondTipPoint.x, tipPoint.y - secondTipPoint.y);
          
          // If moving actively, eject sparkles at the tip (scale quantity with quickness)
          // PERF: Skip in camera mode - saves particle alloc/render per frame
          const sparksChance = Math.min(0.85, 0.35 + tipDist * 0.015);
          if (!effectivePerformanceMode && tipDist > 6 && Math.random() < sparksChance) {
            const mode = stateRef.current.gameMode;
            let customGravity = 0.04;
            const maxSparksCount = tipDist > 20 ? 3 : 1;

            for (let s = 0; s < maxSparksCount; s++) {
              if (mode === 'classic') {
                customGravity = -0.015; // upward drift
              } else {
                customGravity = 0.05; // classic arcade bounce
              }

              stateRef.current.particles.push({
                id: stateRef.current.nextId++,
                x: tipPoint.x + (Math.random() - 0.5) * 8,
                y: tipPoint.y + (Math.random() - 0.5) * 8,
                vx: (tipPoint.x - secondTipPoint.x) * 0.18 + (Math.random() - 0.5) * 2.8,
                vy: (tipPoint.y - secondTipPoint.y) * 0.18 + (Math.random() - 0.5) * 2.8 - (mode === 'classic' ? 1.2 : 0.6),
                color: Math.random() < 0.68 ? sparkColor1 : sparkColor2,
                alpha: 1.0,
                size: Math.random() * (tipDist > 22 ? 3.5 : 2.0) + 1.2,
                gravity: customGravity
              });
            }
          }

          // PERF: In camera mode, render single-pass trail (saves 2/3 of stroke calls).
          // In normal mode, render 3 layered passes for the full cinematic blade effect.
          // effectivePerformanceMode is captured at the top of updateLoop each frame.
          ctx.save();
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';

          // HIGH PERFORMANCE TRAIL ENVELOPE: Draw entire sword slash with one polygon fill!
          const drawEnvelope = (trail: TrailPoint[], colorBase: string, maxWidth: number, isCore: boolean) => {
            if (trail.length < 2) return;
            const tip = trail[trail.length - 1];
            const tail = trail[0];
            
            ctx.beginPath();
            
            // Move up the left side of the blade
            for (let i = 0; i < trail.length; i++) {
              const p = trail[i];
              const pNext = i < trail.length - 1 ? trail[i + 1] : p;
              const pPrev = i > 0 ? trail[i - 1] : p;
              
              let dx = pNext.x - pPrev.x;
              let dy = pNext.y - pPrev.y;
              // Math.sqrt is significantly faster than Math.hypot in V8
              const len = Math.sqrt(dx*dx + dy*dy) || 1;
              dx /= len;
              dy /= len;
              const nx = -dy;
              const ny = dx;
              
              const ratio = (i + 1) / trail.length;
              const segSpeed = Math.min(Math.max(len / 13, 0.75), 2.8);
              const width = maxWidth * ratio * segSpeed;
              
              if (i === 0) ctx.moveTo(p.x + nx * width, p.y + ny * width);
              else ctx.lineTo(p.x + nx * width, p.y + ny * width);
            }
            
            // Move down the right side of the blade
            for (let i = trail.length - 1; i >= 0; i--) {
              const p = trail[i];
              const pNext = i < trail.length - 1 ? trail[i + 1] : p;
              const pPrev = i > 0 ? trail[i - 1] : p;
              
              let dx = pNext.x - pPrev.x;
              let dy = pNext.y - pPrev.y;
              const len = Math.sqrt(dx*dx + dy*dy) || 1;
              dx /= len;
              dy /= len;
              const nx = -dy;
              const ny = dx;
              
              const ratio = (i + 1) / trail.length;
              const segSpeed = Math.min(Math.max(len / 13, 0.75), 2.8);
              const width = maxWidth * ratio * segSpeed;
              
              ctx.lineTo(p.x - nx * width, p.y - ny * width);
            }
            ctx.closePath();
            
            // Create fading gradient from base to tip
            const grad = ctx.createLinearGradient(tail.x, tail.y, tip.x, tip.y);
            grad.addColorStop(0, colorBase + '0)');
            grad.addColorStop(0.5, colorBase + (isCore ? '0.6)' : '0.4)'));
            grad.addColorStop(1, colorBase + (isCore ? '0.95)' : '0.85)'));
            ctx.fillStyle = grad;
            ctx.fill();
          };

          if (!effectivePerformanceMode) {
             drawEnvelope(activeTrail, trailColor1, 16, false); // Wide aura
             drawEnvelope(activeTrail, trailColor2, 8, false);  // Hot trail
          }
          drawEnvelope(activeTrail, trailColor3, 3, true);      // Core laser edge

          ctx.restore();
        }
      });

      // Reset shadows for standard drawings to boost performance
      ctx.shadowBlur = 0;

      // Draw hand coordinate halo indicator if we are in optical sensor mode
      if (controlMode === 'camera') {
        const now = Date.now();
        [
          { lastX: stateRef.current.lastX, lastY: stateRef.current.lastY, active: now - lastHandTrackedTimeRef.current[0] < 500, isHand1: false },
          { lastX: stateRef.current.lastX1, lastY: stateRef.current.lastY1, active: now - lastHandTrackedTimeRef.current[1] < 500, isHand1: true }
        ].forEach(({ lastX, lastY, active, isHand1 }) => {
          if (active && lastX > 0 && lastY > 0) {
            ctx.save();
            const cursorX = lastX;
            const cursorY = lastY;
            
            // PERF: Simplified halo cursor - single dot, no pulsation math
            const dotColor = !isHand1 ? '#10b981' : '#ec4899';
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cursorX, cursorY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = dotColor;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore();
          }
        });
      }

      if (isPlaying && controlMode === 'mouse') {
        // 3. Collision logic: trace sword swipes against floating food (only for mouse mode, as camera mode runs instantly)
        [activeTrail, activeTrail1].forEach(trail => {
          if (trail.length > 1) {
            const p1 = trail[trail.length - 2];
            const p2 = trail[trail.length - 1];

            stateRef.current.items.forEach(item => {
              if (!item.isSliced && !item.isPreSlicing) {
                const hit = checkLineCircleCollision(p1.x, p1.y, p2.x, p2.y, item.x, item.y, item.radius);
                if (hit > 0) {
                  handleSliceHit(item, p1.x, p1.y, p2.x, p2.y, hit, ctx);
                }
              }
            });
          }
        });
      }

      // 4. Update and Draw items
      if (isPlaying) {
        const newItemsToSpawn: GameItem[] = [];
        const items = stateRef.current.items;
        let activeItemsCount = 0;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          let keepItem = true;

          // Handle pre-slicing frame scale-up animation and final splitting division
          if (item.isPreSlicing && !isPaused) {
            item.preSliceFrames = (item.preSliceFrames || 0) + 1 * timeScale;
            const maxFrames = item.preSliceMaxFrames || 7;
            
            if (item.preSliceFrames >= maxFrames) {
              // Trigger actual division splits at the end of the bounce sequence!
              item.isSliced = true;
              item.sliceAngle = item.swipeAngle || 0;
              
              const swipeAngle = item.swipeAngle || 0;
              const speedRatio = item.speedRatio || 1.0;
              const now = Date.now();
              
              // Spawn tasty sauce & topping splat crumbs perfectly at final split moment
              const countBase = Math.round(18 * speedRatio);
              addSplatParticles(item.x, item.y, item.color, countBase, item.type, speedRatio);
              
              if (item.state === PizzaState.Whole) {
                const splitAngle1 = swipeAngle + Math.PI / 2;
                const splitAngle2 = swipeAngle - Math.PI / 2;

                const half1: GameItem = {
                  id: stateRef.current.nextId++,
                  type: item.type,
                  state: PizzaState.Half,
                  x: item.x + Math.cos(splitAngle1) * 12,
                  y: item.y + Math.sin(splitAngle1) * 12,
                  vx: item.vx * 0.75 + Math.cos(splitAngle1) * 2.5,
                  vy: item.vy * 0.85 - 1.8,
                  radius: item.radius,
                  isSliced: false,
                  sliceAngle: swipeAngle,
                  rotation: splitAngle1,
                  rotationSpeed: (-0.06 - Math.random() * 0.04) * (item.gravity ? Math.sqrt(item.gravity / 0.28) : 1),
                  color: item.color,
                  points: 15,
                  label: item.label,
                  cutsMade: 0,
                  gravity: item.gravity,
                  lastCutTime: now,
                };

                const half2: GameItem = {
                  id: stateRef.current.nextId++,
                  type: item.type,
                  state: PizzaState.Half,
                  x: item.x + Math.cos(splitAngle2) * 12,
                  y: item.y + Math.sin(splitAngle2) * 12,
                  vx: item.vx * 0.75 + Math.cos(splitAngle2) * 2.5,
                  vy: item.vy * 0.85 - 1.8,
                  radius: item.radius,
                  isSliced: false,
                  sliceAngle: swipeAngle,
                  rotation: splitAngle1 + Math.PI,
                  rotationSpeed: (0.06 + Math.random() * 0.04) * (item.gravity ? Math.sqrt(item.gravity / 0.28) : 1),
                  color: item.color,
                  points: 15,
                  label: item.label,
                  cutsMade: 0,
                  gravity: item.gravity,
                  lastCutTime: now,
                };

                newItemsToSpawn.push(half1, half2);
              } else {
                createSlicedSectors(item, swipeAngle);
              }
              keepItem = false;
            }
          }

          // Smooth 60fps velocity integration
          if (keepItem && !isPaused) {
            item.x += item.vx * timeScale;
            item.y += item.vy * timeScale;
            item.vy += (item.gravity || 0.18) * timeScale;
            item.rotation += item.rotationSpeed * timeScale;
          }

          const isOutOfScreen = item.y > height + 100;

          if (keepItem && isOutOfScreen) {
            // If good pizza falls unsliced
            if (!item.isSliced && !item.isPreSlicing && item.type !== PizzaType.Pineapple && item.type !== PizzaType.Burnt && item.type !== PizzaType.Golden && item.type !== PizzaType.Clock) {
              if (stateRef.current.gameMode === 'classic') {
                stateRef.current.lives = Math.max(0, stateRef.current.lives - 1);
                updateHUD();
                playWebSound('error');
              } else {
                stateRef.current.score = Math.max(0, stateRef.current.score - 5);
                updateHUD();
              }
            }
            keepItem = false;
          }

          if (keepItem && item.isSliced) {
            keepItem = false;
          }

          if (!keepItem) continue;

          items[activeItemsCount++] = item;

        // Draw standard rotating pizza
        ctx.save();
        ctx.translate(item.x, item.y);

        if (item.isPreSlicing) {
          // Bounce / Bulge scale-up expansion effect (peaks beautifully at progress=0.5)
          const progress = (item.preSliceFrames || 0) / (item.preSliceMaxFrames || 7);
          const bounceFactor = 1.0 + Math.sin(progress * Math.PI) * 0.42;
          ctx.scale(bounceFactor, bounceFactor);
        }

        // 1. Draw Floating Cuts Counter Badge above the pizza
        if (item.cutsMade && item.cutsMade > 0 && item.type !== PizzaType.Pineapple && item.type !== PizzaType.Burnt) {
          ctx.save();
          const totalCutsNeeded = 1;
          const text = `${item.cutsMade}/${totalCutsNeeded} CORTE`;
          
          ctx.font = '14px "VT323", monospace';
          const textWidth = ctx.measureText(text).width;
          const paddingX = 8;
          const paddingY = 3.5;
          const badgeW = textWidth + paddingX * 2;
          const badgeH = 15;
          const badgeY = -item.radius - 22;

          // Draw pill background with glassmorphism glow
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = item.cutsMade >= totalCutsNeeded ? '#22d3ee' : '#f43f5e';
          ctx.lineWidth = 1.6;
          ctx.lineJoin = 'round';
          
          // Draw standard rounded rect
          ctx.beginPath();
          ctx.arc(-badgeW / 2 + 5, badgeY + badgeH / 2, 5, Math.PI * 0.5, Math.PI * 1.5);
          ctx.arc(badgeW / 2 - 5, badgeY + badgeH / 2, 5, Math.PI * 1.5, Math.PI * 2.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Small pulsing inner status dot
          const nowMs = Date.now();
          const dotPulse = Math.sin(nowMs * 0.015) * 0.25 + 0.75;
          ctx.fillStyle = item.cutsMade >= totalCutsNeeded ? '#22d3ee' : '#f43f5e';
          ctx.beginPath();
          ctx.arc(-badgeW / 2 + 7, badgeY + badgeH / 2, 2.5 * dotPulse, 0, Math.PI * 2);
          ctx.fill();

          // Text content
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, 5, badgeY + badgeH / 2 + 0.5);

          ctx.restore();
        }

        // Circular ambient glow
        if (!effectivePerformanceMode) {
          ctx.beginPath();
          const fillGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, item.radius * 1.05);
          fillGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
          fillGrad.addColorStop(0.35, item.color + '1a'); // glow
          fillGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = fillGrad;
          ctx.arc(0, 0, item.radius * 1.05, 0, Math.PI * 2);
          ctx.fill();
        }

        // High quality fast vector pizza with cuts progress!
        drawPizzaVector(ctx, item.type, item.state, item.radius, item.rotation, item.cutsMade || 0);

        if (item.isPreSlicing) {
          // Draw a brilliant white laserslash cut line with a glowing cyan envelope
          ctx.save();
          ctx.rotate(item.swipeAngle || 0);

          const progress = (item.preSliceFrames || 0) / (item.preSliceMaxFrames || 7);
          const drawProgress = 1.0 - progress;

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 5.0 * drawProgress;
          ctx.beginPath();
          ctx.moveTo(-item.radius * 1.35, 0);
          ctx.lineTo(item.radius * 1.35, 0);
          ctx.stroke();

          ctx.strokeStyle = activeBladeColor; // vivid blade border
          ctx.lineWidth = 1.8 * drawProgress;
          ctx.stroke();

          ctx.restore();
        }

        ctx.restore();
      }
      
      stateRef.current.items.length = activeItemsCount;


      if (newItemsToSpawn.length > 0) {
        stateRef.current.items.push(...newItemsToSpawn);
      }

      // 5. Update and Draw Sliced Sector Wedges
      const slicedPieces = stateRef.current.slicedPieces;
      let activePiecesCount = 0;
      for (let i = 0; i < slicedPieces.length; i++) {
        const piece = slicedPieces[i];
        if (!isPaused) {
          piece.x += piece.vx * timeScale;
          piece.y += piece.vy * timeScale;
          piece.vy += (piece.gravity !== undefined ? piece.gravity * 1.25 : 0.35) * timeScale; // slightly faster gravity for satisfying slice drops
          piece.rotation += piece.rotationSpeed * timeScale;
          piece.alpha -= 0.024 * timeScale; // fade off cleanly
        }

        if (piece.y > height + 80 || piece.alpha <= 0) {
          continue; // clean memory
        }

        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);

        // Draw crispy fading slice vector
        drawPizzaSliceVector(ctx, piece.type, piece.radius, piece.startAngle, piece.endAngle, piece.alpha);

        ctx.restore();
        slicedPieces[activePiecesCount++] = piece;
      }
      slicedPieces.length = activePiecesCount;
    } // End of if (isPlaying)

    // --- MENU / CALIBRATION LOOP (START PIZZA ONLY FOR CAMERA MODE) ---
      if (countdown === null && !isPlaying && controlMode === 'camera' && handDetected) {
        const isMobileStart = width < 600;
        const startX = width / 2;
        const startY = isMobileStart ? height * 0.35 : height / 2; // Más arriba en celulares para no tapar la cámara
        const startRadius = isMobileStart ? 60 : 85;

        // Draw floating "Start" Pizza (Golden / special)
        // Pulse effect
        const pulse = Math.sin(Date.now() * 0.003) * 0.05 + 1;
        
        ctx.save();
        ctx.translate(startX, startY);
        ctx.scale(pulse, pulse);

        // Draw the pizza itself
        drawPizzaVector(ctx, FoodType.Pizza, PizzaState.Whole, startRadius, Date.now() * 0.001, 0);
        
        // "CUT TO START" text hovering over the pizza
        ctx.fillStyle = '#ffffff';
        ctx.font = isMobileStart ? '18px "Pixelify Sans", sans-serif' : '22px "Pixelify Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 0; // Removed blur for maximum crispness
        ctx.fillText('¡CORTA PARA', 0, -startRadius - 20);
        ctx.fillText('INICIAR!', 0, -startRadius);
        ctx.restore();

        // Check if hand/mouse trail slices this Start Pizza!
        [activeTrail, activeTrail1].forEach(trail => {
          if (trail.length > 1) {
            const p1 = trail[trail.length - 2];
            const p2 = trail[trail.length - 1];
            const hit = checkLineCircleCollision(p1.x, p1.y, p2.x, p2.y, startX, startY, startRadius);
            if (hit > 0) {
              // Play slice sounds!
              playWebSound('splat');
              playWebSound('slash');
              
              // Spawn splash sparkles particle explosion!
              const numSparks = 20;
              for (let s = 0; s < numSparks; s++) {
                const sAngle = Math.random() * Math.PI * 2;
                const sSpeed = 3.5 + Math.random() * 5;
                stateRef.current.particles.push({
                  x: startX,
                  y: startY,
                  vx: Math.cos(sAngle) * sSpeed,
                  vy: Math.sin(sAngle) * sSpeed - 2,
                  color: '#fbbf24', // Golden sparks
                  alpha: 1.0,
                  size: Math.random() * 3 + 1.5,
                  gravity: 0.15,
                });
              }
              
              // Start the game with countdown!
              initiateCountdown();
            }
          }
        });
      }

      // 6. Update and Draw Crumb particles and Shockwaves
      // Performance Optimization: Scale max particles based on screen size to prevent mobile rendering lag
      const isMobile = Math.min(window.innerWidth, window.innerHeight) < 600;
      const maxParticles = effectivePerformanceMode
        ? (isMobile ? 4 : 8)   // camera mode: minimal particles
        : (isMobile ? 32 : 95);
      if (stateRef.current.particles.length > maxParticles) {
        stateRef.current.particles = stateRef.current.particles.slice(-maxParticles);
      }

      // High-performance in-place array filter to avoid frame allocations (allocation-free GC cleanup)
      const particles = stateRef.current.particles;
      let writeParticlesIdx = 0;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let keep = true;

        if (p.isGlow) {
          if (!isPaused) {
            // Shockwave expands outward and fades out rapidly
            p.size += (p.maxSize ? (p.maxSize - p.size) * 0.18 * timeScale : 3.5 * timeScale);
            p.alpha -= 0.048 * timeScale; // fades out in ~21 frames
          }
          
          if (p.alpha <= 0) {
            keep = false;
          } else {
            ctx.save();
            
            if (isMobile) {
              // High-performance double-pass concentric fill for mobile devices (GPU rasterized, zero stroke cost)
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size * 0.75, 0, Math.PI * 2);
              ctx.fillStyle = p.color;
              ctx.globalAlpha = p.alpha * 0.35;
              ctx.fill();

              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.globalAlpha = p.alpha;
              ctx.fill();
            } else {
              // Draw outer neon halo circle with high contrast glow using multi-pass strokes rather than CPU-bound shadowBlur
              ctx.globalAlpha = p.alpha * 0.45;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.strokeStyle = p.color;
              ctx.lineWidth = 7.0; // wide glow stroke
              ctx.stroke();

              ctx.globalAlpha = p.alpha;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.strokeStyle = '#ffffff'; // intense hot razor-sharp core
              ctx.lineWidth = 2.2;
              ctx.stroke();
              
              // Inner core circle using high-performance concentric fill passes (GPU rasterized)
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size * 0.65, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.95})`;
              ctx.fill();

              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2);
              ctx.fillStyle = p.color + '4d'; // 30% opacity overlay
              ctx.fill();
            }
            
            ctx.restore();
          }
        } else {
          if (!isPaused) {
            p.x += p.vx * timeScale;
            p.y += p.vy * timeScale;
            if (!p.isStain) {
              p.vy += (p.gravity || 0) * timeScale;
              p.alpha -= 0.038 * timeScale;
            } else {
              // Juicy Screen Stains: they stick to the screen and slowly drip down
              p.vy += (p.gravity || 0) * 0.05 * timeScale; 
              p.vx *= Math.pow(0.85, timeScale); // extreme drag
              p.alpha -= 0.008 * timeScale; // slow fade (hangs around longer)
            }
          }

          if (p.alpha <= 0) {
            keep = false;
          } else {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            if (p.emoji) {
              ctx.font = `${Math.round(p.size * 10)}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(p.emoji, p.x, p.y);
            } else {
              ctx.fillStyle = p.color;
              ctx.beginPath();
              if (p.isStain) {
                // Draw a stretched out dripping splat
                ctx.ellipse(p.x, p.y, p.size * 1.5, p.size * 3.5, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
              } else {
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              }
              ctx.fill();
            }
            ctx.restore();
          }
        }

        if (keep) {
          particles[writeParticlesIdx++] = p;
        }
      }
      particles.length = writeParticlesIdx;

      // 7. Update and Draw Floating Combo Text overlays
      let currentFont = '';
      const comboTexts = stateRef.current.comboTexts || [];
      let activeComboCount = 0;
      
      for (let i = 0; i < comboTexts.length; i++) {
        const ct = comboTexts[i];
        
        if (!isPaused) {
          ct.age += 1 * timeScale;
          ct.x += ct.vx * timeScale;
          ct.y += ct.vy * timeScale;
          ct.vy *= Math.pow(0.985, timeScale); // slight deceleration
        }
        
        const lifeRatio = ct.age / ct.maxAge;
        
        // Dynamic Pop-In Scale Animation (Elastic overshoot using easeOutBack)
        const popDuration = 14;
        let popScale = 1.0;
        if (ct.age < popDuration) {
          const progress = ct.age / popDuration;
          const c1 = 1.70158;
          const c3 = c1 + 1;
          popScale = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
          popScale = Math.max(0, popScale);
        }

        // Smooth Quadratic Alpha Decay
        const fadeStartRatio = 0.45;
        let currentAlpha = 1.0;
        if (lifeRatio > fadeStartRatio) {
          const fadeProgress = (lifeRatio - fadeStartRatio) / (1.0 - fadeStartRatio);
          currentAlpha = Math.max(0, 1.0 - fadeProgress * fadeProgress);
        }
        ct.alpha = currentAlpha;
        
        if (ct.alpha <= 0) continue;

        // Interactive Sinusoidal Sway Wobble
        const wobble = Math.sin(ct.age * 0.18) * 0.08 * (1.0 - lifeRatio);
        const drawRotation = (ct.rotation || 0) + wobble;

        ctx.save();
        ctx.globalAlpha = ct.alpha;
        
        // Translate to the combo text coordinates and rotate/scale correctly
        ctx.translate(ct.x, ct.y);
        ctx.rotate(drawRotation);
        
        const totalScale = ct.scale * popScale;
        ctx.scale(totalScale, totalScale);
        
        const baseSize = 10.5;
        const requiredFont = `italic 900 ${baseSize}px "Inter", sans-serif`;
        if (currentFont !== requiredFont) {
          ctx.font = requiredFont;
          currentFont = requiredFont;
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // High quality multi-pass outline for maximum readability against background action
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.2;
        ctx.strokeText(ct.text, 0, 0);
        
        ctx.fillStyle = ct.color;
        ctx.fillText(ct.text, 0, 0);
        
        if (ct.subtext) {
          // Adjust subtext slightly downward
          const subtextFont = `20px "VT323", monospace`;
          if (currentFont !== subtextFont) {
            ctx.font = subtextFont;
            currentFont = subtextFont;
          }
          const subtextY = 9.5;
          
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.2;
          ctx.strokeText(ct.subtext, 0, subtextY);
          
          ctx.fillStyle = '#ffffff';
          ctx.fillText(ct.subtext, 0, subtextY);
        }
        
        ctx.restore();
        comboTexts[activeComboCount++] = ct;
      }
      comboTexts.length = activeComboCount;
      stateRef.current.comboTexts = comboTexts;

      ctx.restore(); // Restore from screen shake translation

      // 8. Draw high-tech pause overlay on the screen
      if (isPlaying && isPausedRef.current) {
        ctx.save();
        ctx.fillStyle = 'rgba(10, 13, 20, 0.88)'; // elegant dark slate back-overlay
        ctx.fillRect(0, 0, width, height);

        // Draw a pulsing border around the screen in crimson
        const pulse = Math.sin(Date.now() * 0.005) * 0.5 + 0.5; // 0 to 1
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.25 + pulse * 0.35})`;
        ctx.lineWidth = 6;
        ctx.strokeRect(0, 0, width, height);

        // Large high-tech pause icon
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
        ctx.font = '24px "Press Start 2P", cursive';
        ctx.fillText('⏸️ DETECCIÓN PERDIDA', width / 2, height / 2 - 30);

        ctx.fillStyle = '#fff';
        ctx.font = '24px "VT323", monospace';
        ctx.fillText('¡MAMMA MIA! SE HA PERDIDO EL SECTOR DE TU MANO', width / 2, height / 2 + 15);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '20px "VT323", monospace';
        ctx.fillText('Muestra tu mano frente a la cámara para reanudar automáticamente...', width / 2, height / 2 + 40);

        ctx.restore();
      }

    }; // end updateLoop

    // Assign loopRunner (deltaTime calculated) AFTER updateLoop is defined.
    loopRunner = () => {
      const now = performance.now();
      let dt = now - lastRenderTs;
      lastRenderTs = now;
      
      // Prevent huge jumps if the user switched tabs (cap at 100ms)
      if (dt > 100) dt = 100;
      
      // Calculate timeScale relative to a perfect 60fps frame (16.666ms)
      const timeScale = dt / (1000 / 60);

      updateLoop(timeScale);
      
      animationFrameId = requestAnimationFrame(loopRunner);
    };

    // Kick off the game loop
    lastRenderTs = performance.now();
    animationFrameId = requestAnimationFrame(loopRunner);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, soundEnabled, controlMode]);

  // Handle pointer tracking inputs
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    stateRef.current.isMousePressed = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * canvas.width : 0;
    const y = rect.height > 0 ? ((e.clientY - rect.top) / rect.height) * canvas.height : 0;
    stateRef.current.lastX = x;
    stateRef.current.lastY = y;

    // Record normalized slash coordinate for Replay (0 to 1 scaling)
    if (stateRef.current.slashHistory) {
      const pctX = canvas.width > 0 ? x / canvas.width : 0.5;
      const pctY = canvas.height > 0 ? y / canvas.height : 0.5;
      const t = Date.now() - (stateRef.current.startTime || Date.now());
      stateRef.current.slashHistory.push({ x: pctX, y: pctY, t, isStart: true });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!stateRef.current.isMousePressed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * canvas.width : 0;
    const y = rect.height > 0 ? ((e.clientY - rect.top) / rect.height) * canvas.height : 0;

    // Track slash trail
    stateRef.current.trail.push({ x, y, age: 800 }); // visually beautiful long trail
    stateRef.current.totalSlashes += 1;

    // Record normalized slash coordinate for Replay (0 to 1 scaling)
    if (stateRef.current.slashHistory) {
      const pctX = canvas.width > 0 ? x / canvas.width : 0.5;
      const pctY = canvas.height > 0 ? y / canvas.height : 0.5;
      const t = Date.now() - (stateRef.current.startTime || Date.now());
      stateRef.current.slashHistory.push({ x: pctX, y: pctY, t });
    }

    // Synthesize simple wind cutting sound on fast swipes with a safety cooldown to avoid sound stacking/CPU lag
    const dist = Math.hypot(x - stateRef.current.lastX, y - stateRef.current.lastY);
    const now = Date.now();
    if (dist > 18 && now - (stateRef.current.lastSlashSoundTime || 0) > 135) {
      // playWebSound('slash'); // Removed constant slash noise, it now ONLY plays when hitting a pizza!
      stateRef.current.lastSlashSoundTime = now;
    }

    stateRef.current.lastX = x;
    stateRef.current.lastY = y;
  };

  const handleSliceHit = (
    item: GameItem,
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    segmentLength: number,
    itemCtx: CanvasRenderingContext2D
  ) => {
    // 2. Cooldown check to prevent instant frame-by-frame double-slicing within the same stroke
    const now = Date.now();
    if (item.lastCutTime && now - item.lastCutTime < 185) {
      return;
    }
    item.lastCutTime = now;

    const dx = p2x - p1x;
    const dy = p2y - p1y;
    const swipeAngle = Math.atan2(dy, dx);

    // Calculate precision intersection coordinates on the swipe line closest to the item center
    const dLen = segmentLength;
    const uRatio = dLen === 0 ? 0 : ((item.x - p1x) * dx + (item.y - p1y) * dy) / (dLen * dLen);
    const clampedURatio = Math.min(Math.max(uRatio, 0), 1);
    const cutPointX = p1x + clampedURatio * dx;
    const cutPointY = p1y + clampedURatio * dy;

    // Helper to spawn brilliant white and glowing cyan/yellow sparks at precision cut point
    const spawnSparkleBlast = (cx: number, cy: number) => {
      const numSparks = 12 + Math.floor(Math.random() * 8);
      for (let s = 0; s < numSparks; s++) {
        const sAngle = Math.random() * Math.PI * 2;
        const sSpeed = 2.2 + Math.random() * 4.8;
        stateRef.current.particles.push({
          id: stateRef.current.nextId++,
          x: cx,
          y: cy,
          vx: Math.cos(sAngle) * sSpeed + (item.vx * 0.45),
          vy: Math.sin(sAngle) * sSpeed + (item.vy * 0.45) - 1.2,
          color: Math.random() < 0.75 ? '#ffffff' : (Math.random() < 0.5 ? '#fde047' : '#22d3ee'),
          alpha: 1.0,
          size: Math.random() * 2.3 + 1.2,
          gravity: 0.12,
        });
      }
    };
    
    // Speed factor representing how fast the swipe moved, with a standard reference point
    const speedRatio = Math.min(Math.max(segmentLength / 15, 0.75), 2.85);

    // 3. Evaluate combo multiplier with non-linear exponential growth for high-level play
    const rawSliceTime = now;
    let multiplier = 1;
    if (rawSliceTime - stateRef.current.lastSliceTime < 550) {
      stateRef.current.comboCount++;
      const combo = stateRef.current.comboCount;
      if (combo >= 3) {
        // Exponential multiplier growth: 3 -> 4x, 4 -> 8x, 5 -> 16x, etc.!
        multiplier = Math.pow(2, combo - 1);
      } else if (combo === 2) {
        multiplier = 2;
      }
    } else {
      stateRef.current.comboCount = 1;
      multiplier = 1;
    }
    stateRef.current.lastSliceTime = rawSliceTime;

    // Update React States so they render cleanly on HUD
    stateRef.current.comboMultiplier = multiplier;
    stateRef.current.ninjaCombo = stateRef.current.comboCount;
    updateHUD();
    setShowComboAlert(stateRef.current.comboCount >= 3);

    // Calculate precision
    const dist = Math.sqrt((item.x - cutPointX) * (item.x - cutPointX) + (item.y - cutPointY) * (item.y - cutPointY));
    const precisionRatio = Math.max(0, Math.min(1, 1 - (dist / item.radius)));
    const displayPercent = Math.round(precisionRatio * 100);

    let accuracyText = "¡BUEN CORTE! 👍";
    let colorClasses = "from-slate-300 via-slate-100 to-slate-400";
    let textColor = "text-slate-300";
    let shadowClass = "shadow-[0_0_12px_rgba(148,163,184,0.3)]";
    let extraScale = 0.95;

    if (precisionRatio >= 0.88) {
      accuracyText = "¡PERFECCIÓN ABSOLUTA! 🏆";
      colorClasses = "from-yellow-400 via-amber-400 to-yellow-300";
      textColor = "text-yellow-400";
      shadowClass = "shadow-[0_0_24px_rgba(234,179,8,0.7)]";
      extraScale = 1.35;
    } else if (precisionRatio >= 0.70) {
      accuracyText = "¡CORTE PERFECTO! ✨";
      colorClasses = "from-cyan-400 via-sky-300 to-blue-500";
      textColor = "text-cyan-400";
      shadowClass = "shadow-[0_0_20px_rgba(6,182,212,0.6)]";
      extraScale = 1.25;
    } else if (precisionRatio >= 0.45) {
      accuracyText = "¡EXCELENTE! 🔥";
      colorClasses = "from-orange-500 via-red-400 to-rose-500";
      textColor = "text-orange-400";
      shadowClass = "shadow-[0_0_16px_rgba(249,115,22,0.5)]";
      extraScale = 1.1;
    }

    const combo = stateRef.current.comboCount;

    // Add floating overlay text to the canvas loop near the swipe point (p2)
    if (combo >= 2 && !performanceMode) {
      let comboLabel = '⚡ COMBO!';
      let comboSub = `x${multiplier} - ${combo} cortes`;
      let comboColor = '#fb923c'; // orange
      if (combo >= 5) {
        comboLabel = '👑 COMBO MAESTRO!';
        comboColor = '#fbbf24'; // gold
      } else if (combo >= 4) {
        comboLabel = '🔥 COMBO TORNADO!';
        comboColor = '#f43f5e'; // rose
      } else if (combo >= 3) {
        comboLabel = '⚔️ COMBO NINJA!';
        comboColor = '#38bdf8'; // sky blue
      }

      // Add precision descriptor to floating text
      if (precisionRatio >= 0.88) {
        comboLabel = `👑 PERFECTO! (${displayPercent}%)`;
      } else if (precisionRatio >= 0.70) {
        comboLabel = `✨ EXCELENTE! (${displayPercent}%)`;
      }

      stateRef.current.comboTexts.push({
        id: stateRef.current.nextId++,
        x: p2x,
        y: p2y - 12,
        text: comboLabel,
        subtext: comboSub,
        color: comboColor,
        alpha: 1.0,
        scale: 0.65 + Math.min(0.20, combo * 0.03),
        rotation: (Math.random() - 0.5) * 0.18, // Random initial tilt
        vx: (Math.random() - 0.5) * 1.8,
        vy: -1.8 - Math.random() * 1.8,
        maxAge: 48,
        age: 0,
      });
    }

    // 1. Obstacles instantly detonate on a single cut
    if (item.type === PizzaType.Pineapple || item.type === PizzaType.Burnt) {
      item.isSliced = true;
      item.sliceAngle = swipeAngle;
      
      if (stateRef.current.gameMode === 'classic') {
        stateRef.current.lives = 0;
        setLives(0);
      } else {
        stateRef.current.lives = Math.max(0, stateRef.current.lives - 1);
        updateHUD();
      }
      
      playWebSound('error');
      
      // RED DAMAGE FLASH overlay!
      setDamageFlash(true);

      // Flash overlay feedback (wider and more vivid for extreme velocity blasts)
      itemCtx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.6, 0.35 * speedRatio)})`;
      itemCtx.fillRect(0, 0, itemCtx.canvas.width, itemCtx.canvas.height);

      // Flash bomb effect particles (boost counts on high speed)
      const bombCrumbs = Math.round(35 * speedRatio);
      addSplatParticles(item.x, item.y, '#eab308', bombCrumbs, item.type, speedRatio);
      return;
    }

    // 2. Power-Ups instantly trigger on a single cut
    if (item.type === PizzaType.Golden || item.type === PizzaType.Clock) {
      item.isSliced = true;
      item.sliceAngle = swipeAngle;
      
      if (item.type === PizzaType.Golden) {
        const scoreGain = 50 * multiplier;
        stateRef.current.score += scoreGain;
        playWebSound('splat');
        addSplatParticles(item.x, item.y, '#facc15', 30, item.type, speedRatio);
        
        // Add floating text for 50 pts
        stateRef.current.comboTexts.push({
          id: stateRef.current.nextId++,
          x: cutPointX,
          y: cutPointY - 10,
          text: '+50 ORO!',
          subtext: '',
          color: '#f59e0b',
          alpha: 1.0,
          scale: 0.8,
          rotation: (Math.random() - 0.5) * 0.2,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -2,
          maxAge: 40,
          age: 0,
        });

      } else if (item.type === PizzaType.Clock) {
        if (stateRef.current.gameMode === 'classic') {
          stateRef.current.lives = Math.min(3, stateRef.current.lives + 1);
          setLives(stateRef.current.lives);
          // Add floating text
          stateRef.current.comboTexts.push({
            id: stateRef.current.nextId++,
            x: cutPointX,
            y: cutPointY - 10,
            text: '+1 VIDA',
            subtext: '',
            color: '#ef4444',
            alpha: 1.0,
            scale: 0.8,
            rotation: 0,
            vx: 0,
            vy: -2,
            maxAge: 40,
            age: 0,
          });
        } else {
          // Arcade mode
          stateRef.current.timeLeft += 10;
          setTimeLeft(stateRef.current.timeLeft);
          // Add floating text
          stateRef.current.comboTexts.push({
            id: stateRef.current.nextId++,
            x: cutPointX,
            y: cutPointY - 10,
            text: '+10 SEGS',
            subtext: '',
            color: '#3b82f6',
            alpha: 1.0,
            scale: 0.8,
            rotation: 0,
            vx: 0,
            vy: -2,
            maxAge: 40,
            age: 0,
          });
        }
        playWebSound('splat');
        addSplatParticles(item.x, item.y, '#60a5fa', 30, item.type, speedRatio);
      }
      updateHUD();
      return;
    }

    // 4. Handle Whole vs Half Slicing Progression with accumulated cuts
    item.cutsMade = (item.cutsMade || 0) + 1;

    if (item.state === PizzaState.Whole) {
      // Whole pizza hit: splits into two smaller halves!
      const scoreGain = 10 * multiplier;
      stateRef.current.score += scoreGain;
      updateHUD();

      playWebSound('splat', stateRef.current.comboCount);
      spawnSparkleBlast(cutPointX, cutPointY);

      // Flag the item to enter a beautiful scale-up tick bounce animation before split division
      item.isPreSlicing = true;
      item.preSliceFrames = 0;
      item.preSliceMaxFrames = 7; // 7 frames of glorious bounce expansion
      item.swipeAngle = swipeAngle;
      item.speedRatio = speedRatio;
      item.cutPointX = cutPointX;
      item.cutPointY = cutPointY;
      item.multiplier = multiplier;
    } else {
      // Half pizza hit (requires only 1 slice to segment into final wedges)
      const scoreGain = 15 * multiplier;
      stateRef.current.score += scoreGain;
      updateHUD();

      playWebSound('splat', stateRef.current.comboCount);
      spawnSparkleBlast(cutPointX, cutPointY);

      // Flag the item to enter a beautiful scale-up tick bounce animation before split division
      item.isPreSlicing = true;
      item.preSliceFrames = 0;
      item.preSliceMaxFrames = 7; // 7 frames of glorious bounce expansion
      item.swipeAngle = swipeAngle;
      item.speedRatio = speedRatio;
      item.cutPointX = cutPointX;
      item.cutPointY = cutPointY;
      item.multiplier = multiplier;
    }
    
    // --- EMIT SLICE EVENT TO GO AUTHORITATIVE SERVER ---
    // Enviar el evento de corte (tanto del ratón como de la cámara si pasan por aquí) al servidor Go,
    // que a su vez lo retransmitirá al Pub/Sub de la nube para el Agente IA de Python.
    try {
      gameSocket.send({
        type: "SLICE",
        timestamp: Date.now(),
        wallet: "anonymous", // TODO: Integrar wallet real en el futuro
        signature: "0x...", // TODO: Firma criptográfica Web3
        trajectory: [
          { x: p1x, y: p1y, timestamp: now - 16, confidence: 1.0 },
          { x: p2x, y: p2y, timestamp: now, confidence: 1.0 }
        ]
      });
    } catch (e) {
      console.warn("Failed to send slice to Go server", e);
    }
  };

  const handlePointerUp = () => {
    stateRef.current.isMousePressed = false;
    stateRef.current.trail = [];
    stateRef.current.trail1 = [];
  };

  const handlePointerLeave = () => {
    stateRef.current.isMousePressed = false;
    stateRef.current.trail = [];
    stateRef.current.trail1 = [];
  };

  const handleHandCoordsTracked = (normX: number, normY: number, handIdx: number, isEngaged: boolean) => {
    if (controlMode !== 'camera') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const activeHandIdx = handIdx === 1 ? 1 : 0;

    // When a hand leaves the frame, clean up its coordinate state so the trail expires cleanly
    // and no phantom slices happen at position (0,0).
    // IMPORTANT: Do NOT reset lastHandTrackedTimeRef here - that would cause immediate auto-pause
    // when the game starts (before the first hand frame arrives). Let handLastUpdateTime expire
    // naturally by the render loop's 500ms check instead.
    if (!isEngaged) {
      stateRef.current.lastRawX[activeHandIdx] = undefined;
      stateRef.current.lastRawY[activeHandIdx] = undefined;
      stateRef.current.currentHandX[activeHandIdx] = undefined;
      stateRef.current.currentHandY[activeHandIdx] = undefined;
      stateRef.current.handVx[activeHandIdx] = 0;
      stateRef.current.handVy[activeHandIdx] = 0;
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const x = normX * canvas.width;
    const y = normY * canvas.height;

    stateRef.current.isMousePressed = true;
    
    // Evitar cortes fantasmas por teletransporte de mano (con gap seguro de 1500ms para móviles y filtro de salto de distancia)
    const now = Date.now();
    const gap = now - lastHandTrackedTimeRef.current[activeHandIdx];
    lastHandTrackedTimeRef.current[activeHandIdx] = now;

    const prevRawX = stateRef.current.lastRawX[activeHandIdx];
    const prevRawY = stateRef.current.lastRawY[activeHandIdx];
    const hasPrev = prevRawX !== undefined && prevRawY !== undefined;
    const dist = hasPrev ? Math.hypot(x - prevRawX, y - prevRawY) : 0;
    const maxJump = canvas.width * 0.35; // 35% del ancho del canvas como salto máximo

    // Guardar coordenadas objetivo para la interpolación visual de la estela a 60 FPS
    stateRef.current.targetHandX[activeHandIdx] = x;
    stateRef.current.targetHandY[activeHandIdx] = y;
    stateRef.current.handLastUpdateTime[activeHandIdx] = now;

    if (gap > 1500 || dist > maxJump || !hasPrev) {
      // Teletransportar posición actual de la estela en saltos bruscos
      stateRef.current.currentHandX[activeHandIdx] = x;
      stateRef.current.currentHandY[activeHandIdx] = y;
      stateRef.current.handVx[activeHandIdx] = 0;
      stateRef.current.handVy[activeHandIdx] = 0;
      
      // Realizar colisión unitaria estática en la nueva posición para mejorar respuesta
      if (isPlaying) {
        stateRef.current.items.forEach(item => {
          if (!item.isSliced && !item.isPreSlicing) {
            const hit = Math.hypot(x - item.x, y - item.y) <= item.radius;
            if (hit) {
              handleSliceHit(item, x, y, x, y, 0, ctx);
            }
          }
        });
      }
      // Check Start Pizza in menu loop - either hand can start the game
      if (countdown === null && !isPlaying) {
        const startX = canvas.width / 2;
        const startY = canvas.height / 2 + Math.sin(Date.now() * 0.0025) * 12;
        const startRadius = 75;
        const hit = Math.hypot(x - startX, y - startY) <= startRadius;
        if (hit) {
          playWebSound('splat');
          playWebSound('slash');
          
          // Spawn particle explosion for feedback
          const numSparks = 20;
          for (let s = 0; s < numSparks; s++) {
            const sAngle = Math.random() * Math.PI * 2;
            const sSpeed = 3.5 + Math.random() * 5;
            stateRef.current.particles.push({
              x: startX,
              y: startY,
              vx: Math.cos(sAngle) * sSpeed,
              vy: Math.sin(sAngle) * sSpeed - 2,
              color: '#f43f5e',
              alpha: 1.0,
              size: Math.random() * 3 + 1.5,
              gravity: 0.15,
            });
          }
          initiateCountdown();
        }
      }
    } else if (dist > 5) {
      // --- ZERO-LAG INSTANTANEOUS PHYSICS COLLISION SWEEP ---
      // Ejecutamos las colisiones en el segmento crudo de cámara de forma instantánea!
      if (isPlaying) {
        stateRef.current.items.forEach(item => {
          if (!item.isSliced && !item.isPreSlicing) {
            const hit = checkLineCircleCollision(prevRawX, prevRawY, x, y, item.x, item.y, item.radius);
            if (hit > 0) {
              handleSliceHit(item, prevRawX, prevRawY, x, y, dist, ctx);
            }
          }
        });
      }

      // Check Start Pizza in menu loop - either hand can start the game
      if (countdown === null && !isPlaying) {
        const startX = canvas.width / 2;
        const startY = canvas.height / 2 + Math.sin(Date.now() * 0.0025) * 12;
        const startRadius = 75;
        const hit = checkLineCircleCollision(prevRawX, prevRawY, x, y, startX, startY, startRadius);
        if (hit > 0) {
          playWebSound('splat');
          playWebSound('slash');
          
          // Spawn particle explosion for feedback
          const numSparks = 20;
          for (let s = 0; s < numSparks; s++) {
            const sAngle = Math.random() * Math.PI * 2;
            const sSpeed = 3.5 + Math.random() * 5;
            stateRef.current.particles.push({
              x: startX,
              y: startY,
              vx: Math.cos(sAngle) * sSpeed,
              vy: Math.sin(sAngle) * sSpeed - 2,
              color: '#f43f5e',
              alpha: 1.0,
              size: Math.random() * 3 + 1.5,
              gravity: 0.15,
            });
          }
          initiateCountdown();
        }
      }
    }

    // Play wind speed swipe swoosh sound effect on fast physical hand movements
    if (dist > 18 && now - (stateRef.current.lastSlashSoundTime || 0) > 130) {
      playWebSound('slash');
      stateRef.current.lastSlashSoundTime = now;
    }

    stateRef.current.lastRawX[activeHandIdx] = x;
    stateRef.current.lastRawY[activeHandIdx] = y;

    stateRef.current.totalSlashes += 1;

    // Record normalized slash history for Replays and Verification only when playing
    if (isPlaying && stateRef.current.slashHistory) {
      const pctX = canvas.width > 0 ? x / canvas.width : 0.5;
      const pctY = canvas.height > 0 ? y / canvas.height : 0.5;
      const t = Date.now() - (stateRef.current.startTime || Date.now());
      stateRef.current.slashHistory.push({ x: pctX, y: pctY, t });
    }
  };

  return (
    <div className="space-y-4 w-full relative max-w-4xl mx-auto">
      <div 
        ref={containerRef} 
        style={{ clipPath: 'inset(0 round 1.5rem)' }}
        className={`relative w-full max-w-4xl mx-auto bg-slate-950/95 shadow-2xl flex flex-col border-[4px] transition-colors duration-150 ${
        damageFlash ? 'border-red-600 bg-red-950/80 shadow-[0_0_50px_rgba(220,38,38,0.8)]' : 'border-amber-500'
      } ${
        isPlaying 
          ? 'aspect-[16/9]' 
          : 'min-h-[640px] landscape:min-h-0 landscape:aspect-[16/9] md:min-h-0 md:aspect-[16/9] overflow-y-auto landscape:overflow-hidden md:overflow-hidden'
      }`}>
      {/* Red damage overlay flash */}
      {damageFlash && (
        <div className="absolute inset-0 bg-red-600/30 pointer-events-none z-50 animate-pulse mix-blend-overlay" />
      )}

      {/* HUD Header */}
      {isPlaying && (
        <div className="absolute top-0 inset-x-0 z-40 px-4 py-4 flex justify-between items-center bg-gradient-to-b from-blue-900/80 to-transparent pointer-events-none select-none">
        
        {/* Left indicators: Score & Lives */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Unified Score */}
          <div className="flex items-center gap-2 bg-slate-900/95 border-4 border-amber-500 px-5 py-2 rounded-2xl shadow-[0_0_15px_rgba(245,158,11,0.5)] relative">
            <span className="text-3xl drop-shadow-md">👑</span>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-widest text-amber-500 font-bold leading-none">Puntos</span>
              <span id="hud-score-display" className="text-3xl font-black text-white leading-none mt-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">{String(stateRef.current.score)}</span>
            </div>

            {/* Embedded Circular Fire Combo Indicator */}
            <div id="hud-combo-container" style={{ display: stateRef.current.ninjaCombo >= 2 ? 'flex' : 'none' }} className="absolute -right-6 -bottom-6 w-16 h-16 bg-slate-900 border-4 border-red-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse z-20">
              <Flame className="absolute -top-3 w-6 h-6 text-orange-500 animate-bounce fill-orange-500" />
              <span id="hud-combo-multiplier" className="text-2xl font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,1)]">x{stateRef.current.comboMultiplier}</span>
            </div>
          </div>

          {/* Lives list pill */}
          <div className="bg-slate-900/95 border-4 border-red-500 px-4 py-2 rounded-2xl shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center gap-2">
            {[1, 2, 3].map((pizzaLifeId) => (
              <span
                key={pizzaLifeId}
                id={`hud-life-${pizzaLifeId}`}
                className={`transition-all duration-300 text-2xl ${
                  stateRef.current.lives >= pizzaLifeId 
                    ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
                    : 'opacity-30 grayscale scale-75'
                }`}
                title={`Vida ${pizzaLifeId}`}
              >
                🍕
              </span>
            ))}
          </div>
        </div>

        {/* Right indicators: Audio & Timer */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Laser Hand Sensor Status Decal */}
          {controlMode === 'camera' && (
            <div className="bg-slate-900/90 border border-emerald-500/35 px-2.5 py-1.5 rounded-2xl flex items-center gap-1.5 font-mono shadow-md text-[9px] font-bold text-emerald-400" title="Control Óptico Activo">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="hidden sm:inline">SENSOR ACTIVO</span>
              <span className="inline sm:hidden font-sans">ÓPTICO</span>
            </div>
          )}

          {/* Dynamic Difficulty Level Badge */}
          <div className="bg-amber-500/90 border-2 border-amber-300 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg border-b-4 border-amber-700" title="Nivel de Horneo actual">
            <Flame className="w-5 h-5 text-white animate-pulse drop-shadow-md fill-white" />
            <span className="text-sm font-vt text-amber-100 uppercase font-bold tracking-wider">Nivel:</span>
            <span className="font-pixel text-lg text-white text-stroke-sm">
              {Math.min(6, 1 + Math.floor((45 - timeLeft) / 8))}
            </span>
          </div>

          {/* Interactive Audio Controls Popover */}
          <div className="relative">
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                setShowSoundSettings(!showSoundSettings);
                playWebSound('splat');
              }}
              className={`border p-3 rounded-2xl transition-all shadow-lg cursor-pointer flex items-center justify-center ${
                showSoundSettings
                  ? 'btn-clash-gold scale-105'
                  : 'btn-clash-blue'
              }`}
              title="Ajustes de Sonido"
            >
              {soundEnabled && globalVolume > 0 ? (
                globalVolume > 0.5 ? <Volume2 className="w-5 h-5" /> : <Volume1 className="w-5 h-5" />
              ) : (
                <VolumeX className="w-5 h-5" />
              )}
            </button>

            {/* Micro Popover Menu */}
            {showSoundSettings && (
              <div id="volume-menu" className="absolute right-0 top-12 w-56 bg-slate-950/98 border border-slate-800 p-3 rounded-2xl shadow-2xl flex flex-col gap-2.5 z-50 animate-fade-in pointer-events-auto">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-[9px] font-mono font-bold text-amber-500 uppercase tracking-widest">Ajustes de Sonido</span>
                  <button
                    onClick={() => {
                      setSoundEnabled(!soundEnabled);
                      playWebSound('splat');
                    }}
                    className="text-[9px] uppercase font-mono font-black text-rose-400 hover:text-rose-300 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/10 cursor-pointer"
                  >
                    {soundEnabled ? 'ACTIVO' : 'MUTED'}
                  </button>
                </div>

                {/* Volume slider */}
                <div className="space-y-1">
                  <span className="text-[8px] font-bold text-slate-400 font-mono tracking-wider block">VOLUMEN GENERAL:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={globalVolume}
                      onChange={(e) => setGlobalVolume(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
                    />
                    <span className="font-mono text-[9px] text-slate-300 w-8 text-right font-medium">
                      {soundEnabled ? `${Math.round(globalVolume * 100)}%` : 'MUTED'}
                    </span>
                  </div>
                </div>

                {/* Theme selector */}
                <div className="space-y-1">
                  <span className="text-[8px] font-bold text-slate-400 font-mono tracking-wider block">BANDA SONORA:</span>
                  <div className="grid grid-cols-2 gap-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setMusicTheme('italian');
                        playWebSound('splat');
                      }}
                      className={`py-1.5 px-1 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all duration-150 cursor-pointer ${
                        musicTheme === 'italian'
                          ? 'bg-slate-900 border-amber-500 text-amber-400 font-bold text-[8px]'
                          : 'border-transparent bg-slate-900/30 text-slate-500 hover:text-slate-300 text-[8px]'
                      }`}
                    >
                      <span className="text-xs">🪗</span>
                      <span className="text-[7px] font-mono leading-none font-bold uppercase">Clásica</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMusicTheme('synthwave');
                        playWebSound('splat');
                      }}
                      className={`py-1.5 px-1 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all duration-150 cursor-pointer ${
                        musicTheme === 'synthwave'
                          ? 'bg-slate-900 border-cyan-500 text-cyan-400 font-bold text-[8px]'
                          : 'border-transparent bg-slate-900/30 text-slate-500 hover:text-slate-300 text-[8px]'
                      }`}
                    >
                      <span className="text-xs">⚡</span>
                      <span className="text-[7px] font-mono leading-none font-bold uppercase">Synthwave</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fullscreen Toggler */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
              playWebSound('splat');
            }}
            className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800/90 p-2 rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center text-slate-300 hover:text-white"
            title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-rose-400" /> : <Maximize2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Time Countdown / Oven Temperature */}
          <div className="bg-slate-900/95 border-4 border-orange-500 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-[0_0_15px_rgba(249,115,22,0.4)]">
            <Flame className={`w-6 h-6 ${
              gameMode === 'arcade' && timeLeft <= 10 ? 'text-red-500 animate-pulse fill-red-500' : 'text-orange-500 fill-orange-500'
            }`} />
            {gameMode === 'arcade' ? (
              <div className="flex flex-col">
                <span className="text-[9px] text-orange-400 font-black tracking-widest uppercase leading-none">Horno</span>
                <span className={`font-black text-2xl leading-none mt-0.5 ${timeLeft <= 10 ? 'text-red-500 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]'}`}>
                  00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                </span>
              </div>
            ) : (
              <span className="font-black text-xs text-slate-200">
                {(() => {
                  const m = Math.floor(elapsedTime / 60);
                  const s = elapsedTime % 60;
                  return `${m < 10 ? `0${m}` : m}:${s < 10 ? `0${s}` : s}`;
                })()}
              </span>
            )}
          </div>
        </div>
      </div>
    )}

      {/* Dynamic accuracy-based Combo Overlay removed to optimize performance. Replaced by Canvas text. */}

      {/* Screen Canvas wrapper to prevent infinite ResizeObserver loops */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden rounded-3xl bg-slate-950">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none z-20 pointer-events-auto"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        />
      </div>

      {/* Danger alert overlay when near death */}
      {lives === 1 && isPlaying && (
        <div className="absolute inset-0 border-4 border-rose-600/20 pointer-events-none animate-pulse flex items-center justify-center">
          <div className="absolute top-24 bg-rose-950/80 border border-rose-500/30 text-rose-300 text-[11px] font-mono px-3 py-1 rounded-full flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>ÚLTIMA VIDA - ¡ALERTA PIÑAS!</span>
          </div>
        </div>
      )}

      {/* Main Menu Overlay */}
      {!isPlaying && !isRegistering && !(controlMode === 'camera' && handDetected) && (
        <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-4 select-none overflow-hidden rounded-3xl transition-all duration-300 bg-slate-950/20 pointer-events-auto`}>
          {/* TOP NAVIGATION BAR */}
          <div className="absolute top-4 md:top-6 inset-x-4 md:inset-x-6 flex justify-between items-start z-[60]">
            {/* Left Icons */}
            <div className="flex flex-row gap-2 md:gap-3 pointer-events-auto relative z-[60]">
              <button onClick={(e) => { e.stopPropagation(); setActiveModal('knives'); playWebSound('splat'); }} className="w-12 h-12 md:w-16 md:h-16 bg-slate-900 border-2 border-rose-500 rounded-full flex items-center justify-center text-xl md:text-2xl hover:scale-110 hover:bg-slate-800 transition-all shadow-[0_0_15px_rgba(244,63,94,0.4)] cursor-pointer">
                🗡️
              </button>
              <button onClick={(e) => { e.stopPropagation(); setActiveModal('rules'); playWebSound('splat'); }} className="w-12 h-12 md:w-16 md:h-16 bg-slate-900 border-2 border-emerald-500 rounded-full flex items-center justify-center text-xl md:text-2xl hover:scale-110 hover:bg-slate-800 transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer">
                📋
              </button>
            </div>

            {/* Right Icons + Wallet */}
            <div className="flex flex-row items-center gap-2 md:gap-3 pointer-events-auto relative z-[60]">
              <button onClick={(e) => { e.stopPropagation(); setActiveModal('settings'); playWebSound('splat'); }} className="w-12 h-12 md:w-16 md:h-16 bg-slate-900 border-2 border-blue-400 rounded-full flex items-center justify-center text-xl md:text-2xl hover:scale-110 hover:bg-slate-800 transition-all shadow-[0_0_15px_rgba(96,165,250,0.4)] cursor-pointer" title="Ajustes">
                ⚙️
              </button>
              <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); playWebSound('splat'); }} className="w-12 h-12 md:w-16 md:h-16 bg-slate-900 border-2 border-indigo-400 rounded-full flex items-center justify-center text-xl md:text-2xl hover:scale-110 hover:bg-slate-800 transition-all shadow-[0_0_15px_rgba(129,140,248,0.4)] cursor-pointer" title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}>
                {isFullscreen ? <Minimize2 className="w-5 h-5 md:w-7 md:h-7 text-indigo-400" /> : <Maximize2 className="w-5 h-5 md:w-7 md:h-7 text-indigo-400" />}
              </button>
              
              {/* Billetera */}
              {/* Billetera */}
              {walletPublicKey ? (
                <div 
                  onClick={(e) => { e.stopPropagation(); onOpenWallet?.(); }}
                  className="bg-slate-800/80 border border-emerald-500/50 rounded-full px-3 md:px-5 h-12 md:h-16 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer hover:bg-slate-700 transition"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-pixel text-emerald-400 text-[9px] md:text-xs">
                    {walletPublicKey.substring(0, 5)}...{walletPublicKey.substring(walletPublicKey.length - 4)}
                  </span>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenWallet?.();
                  }}
                  className="bg-gradient-to-b from-blue-500 to-blue-700 border-2 border-blue-400 rounded-full px-3 md:px-5 h-12 md:h-16 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 md:gap-2 shadow-lg cursor-pointer"
                >
                  <Zap className="w-4 h-4 md:w-5 md:h-5 text-white fill-amber-300 shrink-0" />
                  <span className="font-pixel text-white text-[9px] md:text-xs tracking-wider hidden sm:inline-block">CONECTAR BOVEDA</span>
                  <span className="font-pixel text-white text-[9px] tracking-wider sm:hidden">BOVEDA</span>
                </button>
              )}
            </div>
          </div>

          {/* Main Content Centered */}
          <div className={`flex flex-col landscape:flex-row items-center justify-center gap-2 md:gap-6 landscape:gap-12 w-full max-w-lg landscape:max-w-4xl mx-auto z-10 transition-all duration-300 ${activeModal ? 'blur-md scale-95 opacity-50' : 'blur-0 scale-100 opacity-100'}`}>
            
            {controlMode === 'mouse' ? (
              <>
                {/* Mascot */}
                <div className="relative group animate-[fade-in-up_0.5s_ease-out] shrink-0 pointer-events-none">
                  <div className="absolute -inset-8 bg-gradient-to-r from-emerald-500/20 via-green-500/20 to-blue-500/20 rounded-full blur-3xl animate-pulse" />
                  <img src="/ninja_turtle.png" alt="Ninja Turtle Mascot" className="relative w-48 h-48 md:w-64 md:h-64 landscape:w-48 landscape:h-48 object-contain drop-shadow-[0_0_25px_rgba(16,185,129,0.5)] animate-[bounce_4s_infinite]" />
                </div>

                {/* Right Side / Bottom Side Container */}
                <div className="flex flex-col items-center landscape:items-start w-full max-w-sm landscape:max-w-xl pointer-events-none">
                  {/* Title */}
                  <div className="text-center landscape:text-left mt-[-1rem] landscape:mt-0">
                    <h1 className="text-4xl md:text-5xl landscape:text-6xl font-pixel text-white text-stroke-title tracking-widest leading-none drop-shadow-2xl">Slash Slice</h1>
                    <span className="text-xs md:text-sm font-pixel text-emerald-400 text-stroke-sm uppercase tracking-widest block mt-2 drop-shadow-lg">Turtle Ninja Edition</span>
                  </div>

                  {/* Score badge from last game (conditional) */}
                  {score > 0 && (
                    <div className="bg-slate-900/80 border-2 border-emerald-400/50 rounded-full px-6 py-2 mt-3 flex items-center justify-center gap-3 text-sm font-pixel text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                      <Trophy className="w-4 h-4 text-emerald-500" /> 
                      Última Puntuación: <span className="text-emerald-400">{score}</span>
                    </div>
                  )}

                  {/* AAA Play Buttons */}
                  <div className="flex flex-col gap-3 mt-6 pointer-events-auto z-50 w-full max-w-xs landscape:max-w-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setControlMode('mouse');
                        playWebSound('slash');
                        initiateCountdown();
                      }}
                      className="bg-gradient-to-b from-amber-400 to-amber-600 border-[3px] border-amber-200 rounded-2xl py-4 px-6 text-white font-pixel text-xl md:text-2xl uppercase tracking-widest drop-shadow-[0_4px_0_#b45309] active:translate-y-1 active:drop-shadow-[0_0px_0_#b45309] transition-all hover:brightness-110 flex items-center justify-center gap-3 w-full cursor-pointer shadow-2xl"
                    >
                      <span className="text-3xl drop-shadow-md">🖱️</span>
                      <span>JUGAR NORMAL</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setControlMode('camera');
                        playWebSound('slash');
                      }}
                      className="bg-gradient-to-b from-blue-500 to-blue-700 border-[3px] border-blue-300 rounded-2xl py-3 px-6 text-white font-pixel text-lg md:text-xl uppercase tracking-widest drop-shadow-[0_4px_0_#1e3a8a] active:translate-y-1 active:drop-shadow-[0_0px_0_#1e3a8a] transition-all hover:brightness-110 flex items-center justify-center gap-3 w-full cursor-pointer shadow-xl opacity-90 hover:opacity-100"
                    >
                      <span className="text-2xl drop-shadow-md">📷</span>
                      <span>JUGAR CÁMARA</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* CAMERA MODE WAITING UI */
              <div className="flex flex-col items-center justify-center text-center mt-auto mb-10 pointer-events-none w-full max-w-sm absolute bottom-10 left-1/2 -translate-x-1/2">
                {!handDetected && (
                  <h2 className="text-xl md:text-2xl font-pixel text-white text-stroke-title drop-shadow-xl animate-pulse bg-blue-900/80 p-4 rounded-xl border border-blue-500/50 shadow-2xl">
                    📷 ACERCA TU MANO A LA CÁMARA...
                  </h2>
                )}
                
                <button 
                  onClick={() => { setControlMode('mouse'); playWebSound('splat'); }}
                  className="mt-4 px-6 py-2 bg-slate-800/90 border-2 border-slate-600 rounded-full text-slate-300 font-pixel text-xs uppercase tracking-widest hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-all pointer-events-auto shadow-lg"
                >
                  ◀ VOLVER AL RATÓN
                </button>
              </div>
            )}
          </div>

          {/* (Floating Secondary Buttons moved to TOP NAVIGATION BAR) */}

          {/* Modal Overlay */}
          {activeModal && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 pointer-events-auto" onClick={() => setActiveModal(null)}>
              <div 
                className="panel-clash p-5 md:p-6 rounded-3xl w-full max-w-md animate-[bounce-in_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)]"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6 border-b-2 border-blue-200/20 pb-4">
                  <h2 className="text-xl font-pixel text-white text-stroke-sm">
                    {activeModal === 'knives' && '🗡️ Armería'}
                    {activeModal === 'rules' && '📋 Tutorial'}
                    {activeModal === 'settings' && '⚙️ Ajustes'}
                  </h2>
                  <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto pr-2">
                  {/* KNIVES MODAL CONTENT */}
                  {activeModal === 'knives' && (
                    <div className="space-y-4">
                      <p className="text-blue-200 font-sans text-sm mb-4">Selecciona el diseño de tu espada láser para cortar pizzas con estilo.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'fire', label: 'Fuego', icon: '🔥', color: 'from-orange-500 to-red-600', border: 'border-orange-400' },
                          { id: 'cyber', label: 'Cyber', icon: '⚡', color: 'from-cyan-400 to-blue-600', border: 'border-cyan-400' },
                          { id: 'basil', label: 'Pesto', icon: '🌿', color: 'from-green-400 to-emerald-600', border: 'border-green-400' },
                          { id: 'gold', label: 'Oro', icon: '👑', color: 'from-yellow-300 to-amber-600', border: 'border-yellow-300' }
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => { setBladeStyle(item.id as any); playWebSound('splat'); setActiveModal(null); }}
                            className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border-b-4 border-2 transition-all cursor-pointer ${
                              bladeStyle === item.id 
                                ? `bg-gradient-to-b ${item.color} ${item.border} border-b-0 translate-y-[4px] text-white shadow-inner` 
                                : `bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700`
                            }`}
                          >
                            <span className="text-4xl drop-shadow-lg">{item.icon}</span>
                            <span className="font-pixel text-[10px] uppercase">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RULES MODAL CONTENT */}
                  {activeModal === 'rules' && (
                    <div className="space-y-4 font-sans text-sm text-blue-100">
                      <div className="bg-slate-900/50 p-4 rounded-2xl border border-blue-500/30 flex items-start gap-3">
                        <span className="text-2xl">🍕</span>
                        <div>
                          <strong className="text-white block font-pixel text-[10px] mb-1">Pizza Entera</strong>
                          <p className="text-xs">Corta 1 vez para dividirla en mitades.</p>
                        </div>
                      </div>
                      <div className="bg-slate-900/50 p-4 rounded-2xl border border-blue-500/30 flex items-start gap-3">
                        <span className="text-2xl">🔪</span>
                        <div>
                          <strong className="text-white block font-pixel text-[10px] mb-1">Mitades</strong>
                          <p className="text-xs">Corta de nuevo para hacer rebanadas y ganar puntos.</p>
                        </div>
                      </div>
                      <div className="bg-rose-950/50 p-4 rounded-2xl border border-rose-500/30 flex items-start gap-3">
                        <span className="text-2xl">🍍</span>
                        <div>
                          <strong className="text-rose-400 block font-pixel text-[10px] mb-1">Peligro: Piña y Quemadas</strong>
                          <p className="text-xs">¡No las toques! Pierdes vidas y se incendia el juego.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SETTINGS MODAL CONTENT */}
                  {activeModal === 'settings' && (
                    <div className="space-y-6">
                      {/* Game Mode */}
                      <div>
                        <h3 className="font-pixel text-[10px] text-blue-300 uppercase mb-3">Modo de Juego</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'arcade', label: 'Árcade', icon: '⏱️' },
                            { id: 'classic', label: 'Clásico', icon: '💖' }
                          ].map(mode => (
                            <button
                              key={mode.id}
                              onClick={() => selectGameMode(mode.id as GameMode)}
                              className={`p-2 rounded-xl flex flex-col items-center gap-1 border-b-[3px] border-2 transition-all ${
                                gameMode === mode.id ? 'bg-blue-600 border-blue-400 border-b-0 translate-y-[3px] text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                              }`}
                            >
                              <span className="text-xl">{mode.icon}</span>
                              <span className="font-pixel text-[8px] uppercase">{mode.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Music Theme */}
                      <div>
                        <h3 className="font-pixel text-[10px] text-blue-300 uppercase mb-3">Banda Sonora</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <button onPointerDown={() => { setMusicTheme('italian'); playWebSound('splat'); }} className={`p-3 rounded-xl flex items-center gap-2 border-b-[3px] border-2 transition-all cursor-pointer ${musicTheme === 'italian' ? 'bg-amber-600 border-amber-400 border-b-0 translate-y-[3px] text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                            <span className="text-xl">🤌</span> <span className="font-pixel text-[10px]">Tarantella</span>
                          </button>
                          <button onPointerDown={() => { setMusicTheme('synthwave'); playWebSound('splat'); }} className={`p-3 rounded-xl flex items-center gap-2 border-b-[3px] border-2 transition-all cursor-pointer ${musicTheme === 'synthwave' ? 'bg-fuchsia-600 border-fuchsia-400 border-b-0 translate-y-[3px] text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                            <span className="text-xl">🎹</span> <span className="font-pixel text-[10px]">Synthwave</span>
                          </button>
                        </div>
                      </div>

                      {/* Volume & Perf */}
                      <div className="space-y-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-3">
                          <button onPointerDown={(e) => { e.stopPropagation(); setSoundEnabled(!soundEnabled); }} className="text-amber-500 hover:scale-110 transition-transform cursor-pointer">
                            {soundEnabled && globalVolume > 0 ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-rose-500" />}
                          </button>
                          <input type="range" min="0" max="1" step="0.05" value={globalVolume} onChange={(e) => setGlobalVolume(parseFloat(e.target.value))} className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" onPointerDown={e => e.stopPropagation()} />
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                          <span className="font-pixel text-[9px] text-slate-300">Rendimiento Gráfico</span>
                          <button onPointerDown={(e) => { e.stopPropagation(); togglePerformanceMode(); }} className={`px-3 py-1.5 rounded-lg font-pixel text-[8px] uppercase border cursor-pointer ${performanceMode ? 'bg-blue-900/50 border-blue-500 text-blue-300' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                            {performanceMode ? 'Optimizado' : 'Alto (60 FPS)'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Collapsible Optical Calibration Console Accordion Header */}
      {controlMode === 'camera' && !isPlaying && (
        <div className="w-full max-w-4xl mx-auto mt-4 px-1">
          <button
            type="button"
            onClick={() => {
              setShowFullConsole(!showFullConsole);
              playWebSound('splat');
            }}
            className="w-full bg-slate-900/60 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 px-4 py-3 rounded-2xl flex items-center justify-between text-slate-400 hover:text-white transition-all cursor-pointer shadow-lg duration-150 animate-fade-in"
          >
            <div className="flex items-center gap-2">
              <span className={`p-1.5 rounded-lg border transition-all duration-300 ${
                showFullConsole 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)] animate-pulse'
              }`}>
                ⚡
              </span>
              <span className="font-sans text-xs font-bold uppercase tracking-wider">
                {showFullConsole 
                  ? 'Ocultar Diagnósticos y Calibración de Cámara' 
                  : 'Ajustes de Calibración Óptica y Diagnósticos'}
              </span>
              <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full border tracking-widest font-bold uppercase ${
                handDetected 
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)] animate-pulse' 
                  : 'bg-amber-950/80 border-amber-500/40 text-amber-400 animate-pulse'
              }`}>
                {handDetected ? 'MANO SINCRO' : 'BUSCANDO MANO'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <span>{showFullConsole ? 'Colapsar ▲' : 'Expandir ▼'}</span>
            </div>
          </button>
        </div>
      )}

      {/* Control Panel Console (MediaPipe Webcam feedback) */}
      <AnimatePresence>
        {controlMode === 'camera' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className={
              (isPlaying || (controlMode === 'camera' && handDetected))
                ? "absolute bottom-4 right-4 z-10 w-28 sm:w-40 aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
                : showFullConsole 
                  ? "w-full max-w-4xl mx-auto mt-6 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl z-10"
                  : "absolute inset-0 m-auto z-10 w-64 sm:w-80 aspect-[4/3] rounded-3xl overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.25)] border border-emerald-500 bg-slate-950 flex flex-col scale-[0.85] landscape:scale-[0.8] md:scale-100"
            }
          >
            <HandTracker
              isCompact={isPlaying || (controlMode === 'camera' && handDetected) || !showFullConsole}
              onCoordsTracked={handleHandCoordsTracked}
              canvasWidth={canvasRef.current?.width || 800}
              canvasHeight={canvasRef.current?.height || 450}
              isEnabled={controlMode === 'camera'}
              onHandPresenceChange={setHandDetected}
              onFallbackToMouse={() => {
                setControlMode('mouse');
                onToastMessage?.("Se restableció el control por Ratón/Táctil.", "info");
              }}
              onStatusChange={(status, err) => {
                if (status === 'error') {
                  onToastMessage?.("Fallo de Cámara: " + (err || "Permiso denegado"), "error");
                }
              }}
            />

            {/* Glowing camera start button removed - user now slices the start pizza directly */}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3..2..1.. GO! Countdown Overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/90 z-50 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.2, opacity: 0, rotate: -15 }}
              animate={{ scale: [0.2, 1.2, 1], opacity: 1, rotate: 0 }}
              exit={{ scale: 1.5, opacity: 0, rotate: 15 }}
              transition={{ type: "spring", stiffness: 400, damping: 14 }}
              className="text-center flex flex-col items-center justify-center select-none"
            >
              <span className={`font-black font-sans tracking-tighter italic ${
                countdown === 'GO' 
                  ? 'text-6xl sm:text-8xl bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(16,185,129,0.6)] animate-pulse' 
                  : 'text-7xl sm:text-9xl text-white drop-shadow-[0_0_25px_rgba(244,63,94,0.5)]'
              }`}>
                {countdown}
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-black uppercase tracking-widest text-slate-400 mt-4 bg-slate-950/80 px-4 py-1.5 rounded-full border border-slate-800/80 shadow-md">
                {countdown === 'GO' ? '¡SLA-A-ASH!' : 'Preparando los ingredientes...'}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
