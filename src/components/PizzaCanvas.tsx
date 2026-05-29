import React, { useRef, useEffect, useState } from 'react';
import { Play, RotateCcw, Volume2, VolumeX, ShieldAlert, Zap, Flame, CalendarClock, Trophy, Music, Volume1 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PizzaType, PizzaState, GameItem, Particle, SlicedPiece, TrailPoint, SlashReplayPoint } from '../types';
import HandTracker from './HandTracker';

interface PizzaCanvasProps {
  onGameOver: (score: number, duration: number, slashes: number, slashHistory: SlashReplayPoint[], gameStartTimestamp?: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  onToastMessage?: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function PizzaCanvas({ onGameOver, isPlaying, setIsPlaying, onToastMessage }: PizzaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game states in React for HUD
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(45);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [controlMode, setControlMode] = useState<'mouse' | 'camera'>('mouse');
  
  const [globalVolume, setGlobalVolume] = useState(() => {
    const saved = localStorage.getItem('ninja_global_volume');
    return saved !== null ? parseFloat(saved) : 0.6;
  });
  
  const [musicTheme, setMusicTheme] = useState<'italian' | 'synthwave'>(() => {
    const saved = localStorage.getItem('ninja_music_theme');
    return saved === 'synthwave' ? 'synthwave' : 'italian';
  });

  const [showSoundSettings, setShowSoundSettings] = useState(false);

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
  const [comboDetails, setComboDetails] = useState<{
    count: number;
    precision: number;
    text: string;
    subtext: string;
    textColor: string;
    colorClasses: string;
    shadowClass: string;
    scale: number;
    displayPercent: number;
    timestamp: number;
  } | null>(null);

  const [activeShake, setActiveShake] = useState<'mild' | 'intense' | null>(null);

  useEffect(() => {
    if (activeShake) {
      const timer = setTimeout(() => {
        setActiveShake(null);
      }, activeShake === 'intense' ? 220 : 150);
      return () => clearTimeout(timer);
    }
  }, [activeShake]);

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
    items: [] as GameItem[],
    particles: [] as Particle[],
    slicedPieces: [] as SlicedPiece[],
    trail: [] as TrailPoint[],
    isMousePressed: false,
    lastX: 0,
    lastY: 0,
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

  // Sound generator
  const playWebSound = (type: 'slash' | 'splat' | 'error' | 'gameover', comboFactor = 1) => {
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
      if (comboFactor > 5 && (type === 'slash' || type === 'splat')) {
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
      }
    } catch (e) {
      console.warn('Web Audio no pudo reproducirse (interacción requerida):', e);
    }
  };

  const startGame = () => {
    // Reset mutable ref states
    stateRef.current = {
      score: 0,
      lives: 3,
      timeLeft: 45,
      items: [],
      particles: [],
      slicedPieces: [],
      trail: [],
      isMousePressed: false,
      lastX: 0,
      lastY: 0,
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
    };
    setScore(0);
    setLives(3);
    setTimeLeft(45);
    setGameDifficulty(1);
    setComboMultiplier(1);
    setNinjaCombo(1);
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
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight || 500;
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

  // Primary Gameplay physics and render loops
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlaying) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let clockInterval: NodeJS.Timeout;

    // Timer logic representing seconds countdown
    clockInterval = setInterval(() => {
      stateRef.current.timeLeft -= 1;
      const currentSecs = stateRef.current.timeLeft;
      setTimeLeft(currentSecs);

      // Scale difficulty up slightly every 5 seconds
      const nextDiff = 1 + Math.floor((45 - currentSecs) / 8) * 0.4;
      setGameDifficulty(parseFloat(nextDiff.toFixed(1)));

      if (currentSecs <= 0 || stateRef.current.lives <= 0) {
        clearInterval(clockInterval);
        setIsPlaying(false);
        playWebSound('gameover');
        onGameOver(
          stateRef.current.score, 
          45 - currentSecs, 
          stateRef.current.totalSlashes, 
          stateRef.current.slashHistory || [],
          stateRef.current.startTime
        );
      }
    }, 1000);

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

    // Helper to draw a beautifully realistic hand-baked vector pizza
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

      const isHalf = state === PizzaState.Half;

      if (type === PizzaType.Pineapple) {
        // Draw a gorgeous, extremely detailed spiky green-crowned whole pineapple!
        // This makes the Pineapple immediately distinct and warns the player that it is a special tropical obstacle.
        
        // Let's add a pulsing, radiant golden-red warning halo underneath
        const now = Date.now();
        const pulse = Math.sin(now * 0.01) * 0.15 + 0.85;
        const warningGrad = itemCtx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.15);
        warningGrad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
        warningGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.18)');
        warningGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        itemCtx.fillStyle = warningGrad;
        itemCtx.beginPath();
        itemCtx.arc(0, 0, radius * 1.15 * pulse, 0, Math.PI * 2);
        itemCtx.fill();

        // 1. Draw Leaf Crown at the top of the body (pointing up relative to rotation)
        itemCtx.fillStyle = '#16a34a'; // rich green leaves
        itemCtx.strokeStyle = '#14532d';
        itemCtx.lineWidth = 2.0;

        // Draw multiple leaves fanning out
        const leafPaths = [
          // Middle leaf
          { x1: 0, y1: -radius * 0.3, cx: -radius * 0.08, cy: -radius * 0.75, x2: 0, y2: -radius * 1.1, cx2: radius * 0.08, cy2: -radius * 0.75 },
          // Left leaf
          { x1: -radius * 0.15, y1: -radius * 0.3, cx: -radius * 0.4, cy: -radius * 0.65, x2: -radius * 0.38, y2: -radius * 0.9, cx2: -radius * 0.15, cy2: -radius * 0.5 },
          // Right leaf
          { x1: radius * 0.15, y1: -radius * 0.3, cx: radius * 0.4, cy: -radius * 0.65, x2: radius * 0.38, y2: -radius * 0.9, cx2: radius * 0.15, cy2: -radius * 0.5 },
          // Nested inner leaves
          { x1: -radius * 0.08, y1: -radius * 0.35, cx: -radius * 0.2, cy: -radius * 0.85, x2: -radius * 0.18, y2: -radius * 1.05, cx2: 0, cy2: -radius * 0.65 },
          { x1: radius * 0.08, y1: -radius * 0.35, cx: radius * 0.2, cy: -radius * 0.85, x2: radius * 0.18, y2: -radius * 1.05, cx2: 0, cy2: -radius * 0.65 },
        ];

        leafPaths.forEach(lp => {
          itemCtx.beginPath();
          itemCtx.moveTo(lp.x1, lp.y1);
          itemCtx.quadraticCurveTo(lp.cx, lp.cy, lp.x2, lp.y2);
          itemCtx.quadraticCurveTo(lp.cx2, lp.cy2, lp.x1, lp.y1);
          itemCtx.fill();
          itemCtx.stroke();
        });

        // 2. Draw Pineapple Body (oval)
        // Set up golden orange gradient
        const bodyGrad = itemCtx.createRadialGradient(0, radius * 0.15, 5, 0, radius * 0.15, radius * 0.75);
        bodyGrad.addColorStop(0, '#facc15'); // central yellow
        bodyGrad.addColorStop(0.7, '#ea580c'); // warm orange edge
        bodyGrad.addColorStop(1, '#9a3412'); // deep reddish shadow

        itemCtx.fillStyle = bodyGrad;
        itemCtx.strokeStyle = '#7c2d12';
        itemCtx.lineWidth = 3;

        itemCtx.beginPath();
        // Draw ellipse body representing whole pineapple fruit
        itemCtx.ellipse(0, radius * 0.18, radius * 0.46, radius * 0.62, 0, 0, Math.PI * 2);
        itemCtx.fill();
        itemCtx.stroke();

        // 3. Draw spiky scales texture
        itemCtx.strokeStyle = 'rgba(124, 45, 18, 0.61)';
        itemCtx.lineWidth = 1.8;
        
        // Draw diagonal lines
        for (let strokePass = 0; strokePass < 2; strokePass++) {
          const sign = strokePass === 0 ? 1 : -1;
          for (let offset = -radius * 0.4; offset <= radius * 0.4; offset += radius * 0.22) {
            itemCtx.save();
            itemCtx.beginPath();
            itemCtx.ellipse(0, radius * 0.18, radius * 0.46, radius * 0.62, 0, 0, Math.PI * 2);
            itemCtx.clip();
            
            itemCtx.beginPath();
            itemCtx.moveTo(offset - radius * 0.5 * sign, radius * 0.18 - radius * 0.65);
            itemCtx.lineTo(offset + radius * 0.5 * sign, radius * 0.18 + radius * 0.65);
            itemCtx.stroke();
            itemCtx.restore();
          }
        }

        // Draw little brown scale centers (spikes)
        itemCtx.save();
        itemCtx.beginPath();
        itemCtx.ellipse(0, radius * 0.18, radius * 0.46, radius * 0.62, 0, 0, Math.PI * 2);
        itemCtx.clip();
        
        itemCtx.fillStyle = '#7c2d12';
        const dots = [
          { dx: 0, dy: radius * 0.18 },
          { dx: -radius * 0.2, dy: radius * -0.02 },
          { dx: radius * 0.2, dy: radius * -0.02 },
          { dx: -radius * 0.2, dy: radius * 0.38 },
          { dx: radius * 0.2, dy: radius * 0.38 },
          { dx: 0, dy: radius * -0.15 },
          { dx: 0, dy: radius * 0.51 },
          { dx: -radius * 0.32, dy: radius * 0.18 },
          { dx: radius * 0.32, dy: radius * 0.18 },
        ];
        dots.forEach(d => {
          itemCtx.beginPath();
          // Draw small spiky crown-triangle in each scale
          itemCtx.moveTo(d.dx - 3, d.dy + 1);
          itemCtx.lineTo(d.dx, d.dy - 5);
          itemCtx.lineTo(d.dx + 3, d.dy + 1);
          itemCtx.fill();
        });
        itemCtx.restore();

        // 4. Draw warning/hazardous details (glowing biohazard warning sign on top of the pineapple)
        // This makes it extremely obvious it is a hazard!
        itemCtx.fillStyle = '#ef4444';
        itemCtx.strokeStyle = '#ffffff';
        itemCtx.lineWidth = 1.6;
        
        itemCtx.beginPath();
        itemCtx.arc(0, radius * 0.15, 12, 0, Math.PI * 2);
        itemCtx.fill();
        itemCtx.stroke();

        itemCtx.fillStyle = '#ffffff';
        itemCtx.font = '900 13px sans-serif';
        itemCtx.textAlign = 'center';
        itemCtx.textBaseline = 'middle';
        itemCtx.fillText('⚠️', 0, radius * 0.15 + 0.5);

        itemCtx.restore();
        return;
      }

      // 1. Toasted Crust
      itemCtx.beginPath();
      if (isHalf) {
        itemCtx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
        itemCtx.lineTo(0, -radius);
      } else {
        itemCtx.arc(0, 0, radius, 0, Math.PI * 2);
      }

      if (type === PizzaType.Burnt) {
        itemCtx.fillStyle = '#27272a'; // Carbonised gray
        itemCtx.strokeStyle = '#09090b';
      } else {
        itemCtx.fillStyle = '#ca8a04'; // Warm oven toasted orange crust
        itemCtx.strokeStyle = '#78350f';
      }
      itemCtx.lineWidth = 3.5;
      itemCtx.fill();
      itemCtx.stroke();

      // 2. Rich Marinara Tomato Sauce Base (slightly smaller)
      itemCtx.beginPath();
      const sauceRadius = radius * 0.86;
      if (isHalf) {
        itemCtx.arc(0, 0, sauceRadius, -Math.PI / 2, Math.PI / 2);
        itemCtx.lineTo(0, -sauceRadius);
      } else {
        itemCtx.arc(0, 0, sauceRadius, 0, Math.PI * 2);
      }
      itemCtx.fillStyle = type === PizzaType.Burnt ? '#18181b' : '#b91c1c';
      itemCtx.fill();

      // 3. Gourmet Creamy Melted Mozzarella/Cheddar Cheese
      itemCtx.beginPath();
      const cheeseRadius = radius * 0.78;
      if (isHalf) {
        itemCtx.arc(0, 0, cheeseRadius, -Math.PI / 2, Math.PI / 2);
        itemCtx.lineTo(0, -cheeseRadius);
      } else {
        itemCtx.arc(0, 0, cheeseRadius, 0, Math.PI * 2);
      }

      if (type === PizzaType.Burnt) {
        itemCtx.fillStyle = '#3f3f46'; // burnt cheese
      } else if (type === PizzaType.FourCheese) {
        itemCtx.fillStyle = '#fef08a'; // double golden yellow combo
      } else if (type === PizzaType.Veggie) {
        itemCtx.fillStyle = '#fffbeb'; // creamier white
      } else {
        itemCtx.fillStyle = '#fde047'; // hot standard cheese
      }
      itemCtx.fill();

      // 4. Subtle toasted oven bubbles inside the cheese
      if (type !== PizzaType.Burnt) {
        itemCtx.fillStyle = 'rgba(146, 64, 14, 0.4)'; // baked brown cheese clusters
        const spots = isHalf 
          ? [{ r: radius * 0.25, a: 0.2 }, { r: radius * 0.45, a: -0.5 }, { r: radius * 0.5, a: 0.6 }] 
          : [{ r: radius * 0.15, a: 0.3 }, { r: radius * 0.4, a: -0.9 }, { r: radius * 0.5, a: 1.5 }, { r: radius * 0.3, a: 3.1 }];
        
        spots.forEach(spot => {
          const sx = Math.cos(spot.a) * spot.r;
          const sy = Math.sin(spot.a) * spot.r;
          itemCtx.beginPath();
          itemCtx.arc(sx, sy, radius * 0.08, 0, Math.PI * 2);
          itemCtx.fill();
        });
      }

      // 5. Chef Ingredient Toppings
      if (type === PizzaType.Pepperoni) {
        itemCtx.fillStyle = '#991b1b'; // pepperoni slices
        itemCtx.strokeStyle = '#7f1d1d';
        itemCtx.lineWidth = 1;

        const peps = isHalf 
          ? [{ r: radius * 0.4, a: -0.2 }, { r: radius * 0.45, a: 0.8 }, { r: radius * 0.2, a: 0.3 }]
          : [{ r: radius * 0.4, a: -0.4 }, { r: radius * 0.45, a: 0.8 }, { r: radius * 0.48, a: 2.2 }, { r: radius * 0.32, a: -2.3 }, { r: radius * 0.2, a: 1.1 }];
        
        peps.forEach(p => {
          const px = Math.cos(p.a) * p.r;
          const py = Math.sin(p.a) * p.r;
          
          itemCtx.beginPath();
          itemCtx.arc(px, py, radius * 0.14, 0, Math.PI * 2);
          itemCtx.fill();
          itemCtx.stroke();

          // Pepperoni outer crispy rim shine
          itemCtx.beginPath();
          itemCtx.fillStyle = '#dc2626';
          itemCtx.arc(px, py, radius * 0.1, 0, Math.PI * 2);
          itemCtx.fill();
        });
      } else if (type === PizzaType.Veggie) {
        // Red onion rings, green peppers, black olives
        const items = isHalf
          ? [{ r: radius * 0.3, a: -0.4, item: 'pepper' }, { r: radius * 0.45, a: 0.7, item: 'olive' }, { r: radius * 0.4, a: 0.1, item: 'onion' }]
          : [{ r: radius * 0.3, a: -0.5, item: 'pepper' }, { r: radius * 0.45, a: 0.8, item: 'pepper' }, { r: radius * 0.5, a: -2.2, item: 'olive' }, { r: radius * 0.28, a: 2.5, item: 'olive' }, { r: radius * 0.4, a: 1.4, item: 'onion' }];

        items.forEach(it => {
          const ix = Math.cos(it.a) * it.r;
          const iy = Math.sin(it.a) * it.r;

          if (it.item === 'pepper') {
            itemCtx.strokeStyle = '#16a34a';
            itemCtx.lineWidth = 3;
            itemCtx.lineCap = 'round';
            itemCtx.beginPath();
            itemCtx.arc(ix, iy, radius * 0.1, 0, Math.PI * 0.61);
            itemCtx.stroke();
          } else if (it.item === 'olive') {
            itemCtx.fillStyle = '#0f172a'; // shiny deep olivier black
            itemCtx.beginPath();
            itemCtx.arc(ix, iy, radius * 0.08, 0, Math.PI * 2);
            itemCtx.fill();

            // Olive core hole
            itemCtx.fillStyle = '#fffbeb';
            itemCtx.beginPath();
            itemCtx.arc(ix, iy, radius * 0.03, 0, Math.PI * 2);
            itemCtx.fill();
          } else if (it.item === 'onion') {
            itemCtx.strokeStyle = '#c084fc'; // purple red onion ribbon
            itemCtx.lineWidth = 2;
            itemCtx.beginPath();
            itemCtx.arc(ix, iy, radius * 0.11, 0, Math.PI * 0.8);
            itemCtx.stroke();
          }
        });
      } else if (type === PizzaType.FourCheese) {
        // Deep double cheese splashes and oregano herbs
        itemCtx.fillStyle = '#f97316'; // melted cheddar spots
        const pockets = isHalf 
          ? [{ r: radius * 0.35, a: 0.5 }, { r: radius * 0.42, a: -0.4 }]
          : [{ r: radius * 0.35, a: 0.5 }, { r: radius * 0.42, a: -0.4 }, { r: radius * 0.5, a: 2.3 }, { r: radius * 0.12, a: -1.9 }];
        
        pockets.forEach(pkt => {
          const px = Math.cos(pkt.a) * pkt.r;
          const py = Math.sin(pkt.a) * pkt.r;
          itemCtx.beginPath();
          itemCtx.arc(px, py, radius * 0.13, 0, Math.PI * 2);
          itemCtx.fill();
        });

        // Oregano herb sprinkles
        itemCtx.fillStyle = '#22c55e';
        const sprCount = isHalf ? 8 : 16;
        for (let i = 0; i < sprCount; i++) {
          const sprAngle = (i / sprCount) * Math.PI * 2 + Math.random() * 0.3;
          const sprDist = (0.2 + 0.45 * Math.random()) * radius;
          itemCtx.fillRect(Math.cos(sprAngle) * sprDist, Math.sin(sprAngle) * sprDist, 2.5, 2.5);
        }
      }

      // 6. Dashed line highlighting perfect slice cuts
      if (type !== PizzaType.Burnt) {
        itemCtx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        itemCtx.lineWidth = 1.8;
        itemCtx.setLineDash([5, 5]);
        itemCtx.beginPath();
        if (isHalf) {
          // Half pizza slicing guides
          itemCtx.moveTo(0, 0);
          itemCtx.lineTo(radius * 0.95 * Math.cos(-Math.PI / 4), radius * 0.95 * Math.sin(-Math.PI / 4));
          itemCtx.moveTo(0, 0);
          itemCtx.lineTo(radius * 0.95 * Math.cos(Math.PI / 4), radius * 0.95 * Math.sin(Math.PI / 4));
        } else {
          // Full cruz guides for whole pizza
          itemCtx.moveTo(-radius * 0.9, 0);
          itemCtx.lineTo(radius * 0.9, 0);
          itemCtx.moveTo(0, -radius * 0.9);
          itemCtx.lineTo(0, radius * 0.9);
        }
        itemCtx.stroke();
        itemCtx.setLineDash([]); // clear dash state
      }

      // 7. Visual sliced scar if cut once
      if (!isHalf && cutsMade === 1) {
        itemCtx.strokeStyle = 'rgba(239, 68, 68, 0.9)'; // hot glowing sauce crack
        itemCtx.lineWidth = 4;
        itemCtx.beginPath();
        itemCtx.moveTo(-radius * 0.95, 0);
        itemCtx.lineTo(radius * 0.95, 0);
        itemCtx.stroke();

        itemCtx.fillStyle = '#fde047'; // cheese drip in crack
        itemCtx.beginPath();
        itemCtx.arc(radius * 0.3, 0, 3, 0, Math.PI * 2);
        itemCtx.arc(-radius * 0.4, 0, 3.5, 0, Math.PI * 2);
        itemCtx.fill();

        itemCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        itemCtx.lineWidth = 1.6;
        itemCtx.beginPath();
        itemCtx.moveTo(-radius * 0.9, 0);
        itemCtx.lineTo(radius * 0.9, 0);
        itemCtx.stroke();
      }

      itemCtx.restore();
    };

    // Helper to draw clean fading wedge pieces
    const drawPizzaSliceVector = (
      sliceCtx: CanvasRenderingContext2D,
      type: PizzaType,
      radius: number,
      startAngle: number,
      endAngle: number,
      alpha: number
    ) => {
      sliceCtx.save();
      sliceCtx.globalAlpha = alpha;

      // 1. Sector shape for slices
      sliceCtx.beginPath();
      sliceCtx.moveTo(0, 0);
      sliceCtx.arc(0, 0, radius, startAngle, endAngle);
      sliceCtx.closePath();

      if (type === PizzaType.Burnt || type === PizzaType.Veggie) {
        // match dark or veggie style
        sliceCtx.fillStyle = type === PizzaType.Burnt ? '#27272a' : '#ca8a04';
        sliceCtx.strokeStyle = type === PizzaType.Burnt ? '#09090b' : '#78350f';
      } else {
        sliceCtx.fillStyle = '#ca8a04';
        sliceCtx.strokeStyle = '#78350f';
      }
      sliceCtx.lineWidth = 3;
      sliceCtx.fill();
      sliceCtx.stroke();

      // 2. Tomato sauce
      sliceCtx.beginPath();
      sliceCtx.moveTo(0, 0);
      sliceCtx.arc(0, 0, radius * 0.85, startAngle, endAngle);
      sliceCtx.closePath();
      sliceCtx.fillStyle = type === PizzaType.Burnt ? '#18181b' : '#b91c1c';
      sliceCtx.fill();

      // 3. Mozzarella cheese on sector
      sliceCtx.beginPath();
      sliceCtx.moveTo(0, 0);
      sliceCtx.arc(0, 0, radius * 0.77, startAngle, endAngle);
      sliceCtx.closePath();
      sliceCtx.fillStyle = type === PizzaType.Burnt ? '#3f3f46' : '#fde047';
      sliceCtx.fill();

      // 4. Little topping dot inside slice
      if (type === PizzaType.Pepperoni) {
        sliceCtx.fillStyle = '#dc2626';
        const midA = (startAngle + endAngle) / 2;
        const tx = Math.cos(midA) * radius * 0.45;
        const ty = Math.sin(midA) * radius * 0.45;
        sliceCtx.beginPath();
        sliceCtx.arc(tx, ty, radius * 0.12, 0, Math.PI * 2);
        sliceCtx.fill();
      }

      sliceCtx.restore();
    };

    const spawnGameItem = (width: number, height: number, diffScale: number) => {
      const id = stateRef.current.nextId++;
      
      const rand = Math.random();
      let type = PizzaType.Pepperoni;
      let color = '#ef4444'; // default red
      let points = 10;
      let label = 'Pepperoni';

      if (rand < 0.28) {
        type = PizzaType.Pepperoni;
        color = '#ef4444';
        points = 10;
        label = 'Pepperoni';
      } else if (rand < 0.55) {
        type = PizzaType.Veggie;
        color = '#22c55e';
        points = 10;
        label = 'Vegetariana';
      } else if (rand < 0.75) {
        type = PizzaType.FourCheese;
        color = '#fbbf24';
        points = 10;
        label = 'Cuatro Quesos';
      } else if (rand < 0.88) {
        type = PizzaType.Pineapple;
        color = '#facc15';
        points = 5; // tiny warning points
        label = 'Piña';
      } else {
        type = PizzaType.Burnt;
        color = '#4b5563';
        points = 0;
        label = 'Pizza Quemada';
      }

      // Launcher position and speed
      const startX = Math.random() * (width * 0.6) + (width * 0.2);
      const startY = height + 35;
      
      const centerX = width / 2;
      const xOffset = centerX - startX;
      
      // Non-linear (exponential) increase in physics speeds as timeLeft approaches 0 (timeLeft -> 0, so diffScale -> 1.0)
      const diffSetting = DIFFICULTY_SETTINGS[arcadeDifficultyRef.current];
      const speedFactor = diffSetting.speed;
      const expSpeedMult = (1.0 + (Math.exp(diffScale * 1.35) - 1) * 0.65) * speedFactor;

      const vx = (xOffset * 0.0035 + (Math.random() - 0.5) * 1.1) * expSpeedMult;
      const vy = -(Math.random() * 2 + 11.2) * expSpeedMult; 
      const gravity = 0.23 * expSpeedMult * expSpeedMult; // Scale gravity quadratically to match velocity and keep items visually bounded in heights
      const radius = Math.random() * 5 + 34; // more zoomed out / compact size

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

    const addSplatParticles = (x: number, y: number, color: string, count: number, itemType?: PizzaType, speedMult = 1.0) => {
      // 100% vector particles representing juicy sauce, flour crumbs, and cheese. Zero lag.
      let particleColors = [color, '#fbcfe8', '#fef08a']; // sauce, crust, cheese mix
      if (itemType === PizzaType.Burnt) {
        particleColors = ['#18181b', '#3f3f46', '#27272a', '#ea580c']; // ash & fire amber
      } else if (itemType === PizzaType.Pineapple) {
        particleColors = ['#fde047', '#facc15', '#eab308']; // pineapple yellow drips
      }

      // If high speed, spawn dynamic impact shockwave glow rings!
      if (speedMult > 1.25) {
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

    // Main animation frame function
    const updateLoop = () => {
      if (!canvas || !ctx) return;
      const width = canvas.width;
      const height = canvas.height;

      // Calculate screen shake offsets
      let shakeOffsetX = 0;
      let shakeOffsetY = 0;
      if (stateRef.current.shakeDuration && stateRef.current.shakeDuration > 0) {
        stateRef.current.shakeDuration--;
        const intensity = stateRef.current.shakeIntensity || 3;
        shakeOffsetX = (Math.random() - 0.5) * intensity;
        shakeOffsetY = (Math.random() - 0.5) * intensity;
      }

      ctx.save();
      if (shakeOffsetX !== 0 || shakeOffsetY !== 0) {
        ctx.translate(shakeOffsetX, shakeOffsetY);
      }

      // 1. Clear with customized ambient grid backdrop and gradient overlay
      ctx.fillStyle = '#0a0d14'; // slate dark kitchen
      ctx.fillRect(0, 0, width, height);

      // Draw Classic Italian Trattoria Red/White Checkered Tablecloth (subtle overlay)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.04)'; // 4% tomato red checkers 
      const checkerSize = 32;
      for (let cx = 0; cx < width + checkerSize * 2; cx += checkerSize * 2) {
        for (let cy = 0; cy < height + checkerSize * 2; cy += checkerSize * 2) {
          ctx.fillRect(cx, cy, checkerSize, checkerSize);
          ctx.fillRect(cx + checkerSize, cy + checkerSize, checkerSize, checkerSize);
        }
      }

      // Cooker tile lines
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.09)'; // warm kitchen tile borders
      ctx.lineWidth = 1.5;
      for (let i = 0; i < width; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let j = 0; j < height; j += 64) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(width, j);
        ctx.stroke();
      }

      // Roaring Brick Oven hot fire glow radiating from bottom edge where pizzas bake/spawn
      const ovenGrad = ctx.createLinearGradient(0, height, 0, height - 130);
      ovenGrad.addColorStop(0, 'rgba(239, 68, 68, 0.38)'); // hot red-orange tomato
      ovenGrad.addColorStop(0.4, 'rgba(245, 158, 11, 0.16)'); // golden oven heat
      ovenGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ovenGrad;
      ctx.fillRect(0, height - 130, width, 130);

      // Draw subtle neon grid portal under gravity
      const portalGrad = ctx.createRadialGradient(width/2, height, 10, width/2, height, width * 0.7);
      portalGrad.addColorStop(0, 'rgba(244, 63, 94, 0.12)');
      portalGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = portalGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Spawn mechanism
      const diffScale = (45 - stateRef.current.timeLeft) / 45; // 0 to 1
      const baseSpawnInterval = Math.max(1200 - diffScale * 800, 400); // gets faster as game goes
      const diffSetting = DIFFICULTY_SETTINGS[arcadeDifficultyRef.current];
      const spawnInterval = baseSpawnInterval * diffSetting.spawn;

      const now = Date.now();

      // Decaying / resetting combo after 550ms has passed since the last satisfying slice!
      if (stateRef.current.comboCount > 1 && now - stateRef.current.lastSliceTime > 550) {
        stateRef.current.comboCount = 1;
        setComboMultiplier(1);
        setNinjaCombo(1);
        setShowComboAlert(false);
        setComboDetails(null);
      }

      if (now - stateRef.current.lastSpawnTime > spawnInterval) {
        // Emit 1 to 3 items based on difficulty level
        const count = Math.random() < 0.4 ? 1 : Math.random() < 0.8 || diffScale < 0.5 ? 2 : 3;
        for (let s = 0; s < count; s++) {
          spawnGameItem(width, height, diffScale);
        }
        stateRef.current.lastSpawnTime = now;
      }

      // Update and draw sword slash trails
      const trail = stateRef.current.trail;
      for (let i = 0; i < trail.length; i++) {
        trail[i].age -= 16; // reduction speed
      }
      stateRef.current.trail = trail.filter(t => t.age > 0);

      const activeTrail = stateRef.current.trail;
      if (activeTrail.length > 1) {
        const style = bladeStyleRef.current;
        let sparkColor1 = '#fde047'; // yellow
        let sparkColor2 = '#ff5a23'; // red orange
        let trailColor1 = 'rgba(244, 63, 94, '; // PASS 1 background crimson
        let trailColor2 = 'rgba(249, 115, 22, '; // PASS 2 orange
        let trailColor3 = 'rgba(255, 255, 255, '; // PASS 3 core white

        if (style === 'cyber') {
          sparkColor1 = '#38bdf8'; // neon cyan
          sparkColor2 = '#ec4899'; // neon pink
          trailColor1 = 'rgba(236, 72, 153, '; // pink
          trailColor2 = 'rgba(6, 182, 212, ';  // cyan
          trailColor3 = 'rgba(224, 242, 254, '; // pale cyan/white
        } else if (style === 'basil') {
          sparkColor1 = '#a3e635'; // lime green
          sparkColor2 = '#22c55e'; // green
          trailColor1 = 'rgba(20, 83, 45, ';   // deep green
          trailColor2 = 'rgba(34, 197, 94, ';  // neon green
          trailColor3 = 'rgba(240, 253, 244, '; // pale mint green
        } else if (style === 'gold') {
          sparkColor1 = '#fbbf24'; // bright amber
          sparkColor2 = '#ffffff'; // white sparkles
          trailColor1 = 'rgba(146, 64, 14, ';  // bronze brown
          trailColor2 = 'rgba(234, 179, 8, ';  // gold
          trailColor3 = 'rgba(254, 249, 195, '; // golden yellow core
        }

        // Draw fire-like hot particle sparks flying off the blade's leading cutting tip!
        const tipPoint = activeTrail[activeTrail.length - 1];
        const secondTipPoint = activeTrail[activeTrail.length - 2];
        const tipDist = Math.hypot(tipPoint.x - secondTipPoint.x, tipPoint.y - secondTipPoint.y);
        
        // If moving actively, eject oven sparkles at the tip (scale quantity with quickness)
        const sparksChance = Math.min(0.85, 0.35 + tipDist * 0.015);
        if (tipDist > 6 && Math.random() < sparksChance) {
          const maxSparksCount = tipDist > 20 ? 3 : 1;
          for (let s = 0; s < maxSparksCount; s++) {
            stateRef.current.particles.push({
              id: stateRef.current.nextId++,
              x: tipPoint.x + (Math.random() - 0.5) * 6,
              y: tipPoint.y + (Math.random() - 0.5) * 6,
              vx: (tipPoint.x - secondTipPoint.x) * 0.18 + (Math.random() - 0.5) * 2.8,
              vy: (tipPoint.y - secondTipPoint.y) * 0.18 + (Math.random() - 0.5) * 2.8 - 0.6,
              color: Math.random() < 0.68 ? sparkColor1 : sparkColor2,
              alpha: 1.0,
              size: Math.random() * (tipDist > 22 ? 3.5 : 2.0) + 1.2,
              gravity: 0.04,
            });
          }
        }

        // Draw multiple layered passes of lines to produce a stunning hot tapered blade swoosh!
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // PASS 1: Wide background aura
        for (let i = 0; i < activeTrail.length - 1; i++) {
          const p1 = activeTrail[i];
          const p2 = activeTrail[i + 1];
          const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const segSpeedFactor = Math.min(Math.max(segDist / 13, 0.75), 2.8);
          
          const ageRatio = Math.max(0, Math.min(1, p1.age / 300));
          const ratio = (i + 1) / activeTrail.length; // 0 to 1 as it reaches the tip
          const width = 16 * ratio * ageRatio * segSpeedFactor;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          
          const intensity = Math.min(0.85, 0.42 * segSpeedFactor);
          ctx.strokeStyle = `${trailColor1}${intensity * ageRatio})`; 
          ctx.lineWidth = Math.max(1, width);
          ctx.stroke();
        }

        // PASS 2: Middle hot trail
        for (let i = 0; i < activeTrail.length - 1; i++) {
          const p1 = activeTrail[i];
          const p2 = activeTrail[i + 1];
          const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const segSpeedFactor = Math.min(Math.max(segDist / 13, 0.75), 2.8);

          const ageRatio = Math.max(0, Math.min(1, p1.age / 300));
          const ratio = (i + 1) / activeTrail.length;
          const width = 8 * ratio * ageRatio * segSpeedFactor;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          
          const intensity = Math.min(0.95, 0.72 * segSpeedFactor);
          ctx.strokeStyle = `${trailColor2}${intensity * ageRatio})`; 
          ctx.lineWidth = Math.max(0.5, width);
          ctx.stroke();
        }

        // PASS 3: Core super-heated sharp razor-line
        for (let i = 0; i < activeTrail.length - 1; i++) {
          const p1 = activeTrail[i];
          const p2 = activeTrail[i + 1];
          const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const segSpeedFactor = Math.min(Math.max(segDist / 13, 0.75), 2.8);

          const ageRatio = Math.max(0, Math.min(1, p1.age / 300));
          const ratio = (i + 1) / activeTrail.length;
          const width = 3 * ratio * ageRatio * Math.min(1.4, segSpeedFactor);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `${trailColor3}${0.95 * ageRatio})`; 
          ctx.lineWidth = Math.max(0.2, width);
          ctx.stroke();
        }

        ctx.restore();
      }

      // Reset shadows for standard drawings to boost performance
      ctx.shadowBlur = 0;

      // Draw hand coordinate halo indicator if we are in optical sensor mode
      if (controlMode === 'camera' && stateRef.current.lastX && stateRef.current.lastY) {
        ctx.save();
        const cursorX = stateRef.current.lastX;
        const cursorY = stateRef.current.lastY;
        
        // Pulsate outer tracking ring
        const timePulse = Date.now();
        const ringRadius = 15 + Math.sin(timePulse * 0.015) * 2.8;
        
        // Outer glowing dashed ring
        ctx.strokeStyle = '#10b981'; // emerald
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cursorX, cursorY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner hot core
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cursorX, cursorY, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#22d3ee'; // cyan glow border
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(cursorX, cursorY, 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }

      // 3. Collision logic: trace sword swipes against floating food
      if (activeTrail.length > 1) {
        const p1 = activeTrail[activeTrail.length - 2];
        const p2 = activeTrail[activeTrail.length - 1];

        stateRef.current.items.forEach(item => {
          if (!item.isSliced && !item.isPreSlicing) {
            const hit = checkLineCircleCollision(p1.x, p1.y, p2.x, p2.y, item.x, item.y, item.radius);
            if (hit > 0) {
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              const swipeAngle = Math.atan2(dy, dx);

              // Calculate precision intersection coordinates on the swipe line closest to the item center
              const dLen = Math.hypot(dx, dy);
              const uRatio = dLen === 0 ? 0 : ((item.x - p1.x) * dx + (item.y - p1.y) * dy) / (dLen * dLen);
              const clampedURatio = Math.min(Math.max(uRatio, 0), 1);
              const cutPointX = p1.x + clampedURatio * dx;
              const cutPointY = p1.y + clampedURatio * dy;

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
              const speedRatio = Math.min(Math.max(hit / 15, 0.75), 2.85);

              // 1. Obstacles instantly detonate on a single cut
              if (item.type === PizzaType.Pineapple || item.type === PizzaType.Burnt) {
                item.isSliced = true;
                item.sliceAngle = swipeAngle;
                stateRef.current.lives -= 1;
                setLives(stateRef.current.lives);
                playWebSound('error');

                // Flash overlay feedback (wider and more vivid for extreme velocity blasts)
                ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.6, 0.35 * speedRatio)})`;
                ctx.fillRect(0, 0, width, height);

                // Flash bomb effect particles (boost counts on high speed)
                const bombCrumbs = Math.round(35 * speedRatio);
                addSplatParticles(item.x, item.y, '#eab308', bombCrumbs, item.type, speedRatio);
                return;
              }

              // 2. Cooldown check to prevent instant frame-by-frame double-slicing within the same stroke
              const now = Date.now();
              if (item.lastCutTime && now - item.lastCutTime < 185) {
                return;
              }
              item.lastCutTime = now;

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
              setComboMultiplier(multiplier);
              setNinjaCombo(stateRef.current.comboCount);
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

                // Intense Screen Shake
                stateRef.current.shakeDuration = 14;
                stateRef.current.shakeIntensity = 9;
                setActiveShake(null);
                requestAnimationFrame(() => setActiveShake('intense'));
              } else if (precisionRatio >= 0.70) {
                accuracyText = "¡CORTE PERFECTO! ✨";
                colorClasses = "from-cyan-400 via-sky-300 to-blue-500";
                textColor = "text-cyan-400";
                shadowClass = "shadow-[0_0_20px_rgba(6,182,212,0.6)]";
                extraScale = 1.25;

                // Mild Screen Shake
                stateRef.current.shakeDuration = 8;
                stateRef.current.shakeIntensity = 4.5;
                setActiveShake(null);
                requestAnimationFrame(() => setActiveShake('mild'));
              } else if (precisionRatio >= 0.45) {
                accuracyText = "¡EXCELENTE! 🔥";
                colorClasses = "from-orange-500 via-red-400 to-rose-500";
                textColor = "text-orange-400";
                shadowClass = "shadow-[0_0_16px_rgba(249,115,22,0.5)]";
                extraScale = 1.1;
              }

              const combo = stateRef.current.comboCount;
              if (combo >= 2) {
                setComboDetails({
                  count: combo,
                  precision: precisionRatio,
                  text: accuracyText,
                  subtext: `${displayPercent}% precisión • x${multiplier} Mult`,
                  textColor: textColor,
                  colorClasses: colorClasses,
                  shadowClass: shadowClass,
                  scale: extraScale,
                  displayPercent: displayPercent,
                  timestamp: Date.now()
                });
              } else {
                setComboDetails(null);
              }

              // Add floating overlay text to the canvas loop near the swipe point (p2)
              if (combo >= 2) {
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
                  x: p2.x,
                  y: p2.y - 12,
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

              // 4. Handle Whole vs Half Slicing Progression with accumulated cuts
              item.cutsMade = (item.cutsMade || 0) + 1;

              if (item.state === PizzaState.Whole) {
                // Whole pizza hit: splits into two smaller halves!
                const scoreGain = 10 * multiplier;
                stateRef.current.score += scoreGain;
                setScore(stateRef.current.score);

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
                setScore(stateRef.current.score);

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
            }
          }
        });
      }

      // 4. Update and Draw items
      const newItemsToSpawn: GameItem[] = [];
      stateRef.current.items = stateRef.current.items.filter(item => {
        // Handle pre-slicing frame scale-up animation and final splitting division
        if (item.isPreSlicing) {
          item.preSliceFrames = (item.preSliceFrames || 0) + 1;
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
                sliceAngle: 0,
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
                sliceAngle: 0,
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
            return false; // Remove this item from core list
          }
        }

        // Apply simple physics gravity model
        item.x += item.vx;
        item.y += item.vy;
        item.vy += (item.gravity !== undefined ? item.gravity : 0.28); // gravity force descending
        item.rotation += item.rotationSpeed;

        const isOutOfScreen = item.y > height + 100;

        if (isOutOfScreen) {
          // If good pizza falls unsliced, player loses 5 points as minor penalty
          if (!item.isSliced && !item.isPreSlicing && item.type !== PizzaType.Pineapple && item.type !== PizzaType.Burnt) {
            stateRef.current.score = Math.max(0, stateRef.current.score - 5);
            setScore(stateRef.current.score);
          }
          return false;
        }

        if (item.isSliced) {
          return false; // filtered out
        }

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
          
          ctx.font = '900 10px "JetBrains Mono", monospace';
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

        // Circular ambient backing glow
        ctx.beginPath();
        const fillGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, item.radius * 1.05);
        fillGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        fillGrad.addColorStop(0.35, item.color + '1a'); // glow
        fillGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = fillGrad;
        ctx.arc(0, 0, item.radius * 1.05, 0, Math.PI * 2);
        ctx.fill();

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

          ctx.strokeStyle = '#22d3ee'; // vivid cyan blade border
          ctx.lineWidth = 1.8 * drawProgress;
          ctx.stroke();

          ctx.restore();
        }

        ctx.restore();
        return true;
      });

      if (newItemsToSpawn.length > 0) {
        stateRef.current.items.push(...newItemsToSpawn);
      }

      // 5. Update and Draw Sliced Sector Wedges
      stateRef.current.slicedPieces = stateRef.current.slicedPieces.filter(piece => {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += (piece.gravity !== undefined ? piece.gravity * 1.25 : 0.35); // slightly faster gravity for satisfying slice drops
        piece.rotation += piece.rotationSpeed;
        piece.alpha -= 0.024; // fade off cleanly

        if (piece.y > height + 80 || piece.alpha <= 0) {
          return false; // clean memory
        }

        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);

        // Draw crispy fading slice vector
        drawPizzaSliceVector(ctx, piece.type, piece.radius, piece.startAngle, piece.endAngle, piece.alpha);

        ctx.restore();
        return true;
      });

      // 6. Update and Draw Crumb particles and Shockwaves
      // Performance Optimization: Keep a maximum of 95 particles in history to prevent rendering lag on rapid slices
      if (stateRef.current.particles.length > 95) {
        stateRef.current.particles = stateRef.current.particles.slice(-95);
      }

      stateRef.current.particles = stateRef.current.particles.filter(p => {
        if (p.isGlow) {
          // Shockwave expands outward and fades out rapidly
          p.size += (p.maxSize ? (p.maxSize - p.size) * 0.18 : 3.5);
          p.alpha -= 0.048; // fades out in ~21 frames
          
          if (p.alpha <= 0) return false;
          
          ctx.save();
          
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
          
          // Inner core circle for sweet bright glaze flash
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.65, 0, Math.PI * 2);
          const flashGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          flashGrad.addColorStop(0, `rgba(255, 255, 255, ${p.alpha * 0.95})`);
          flashGrad.addColorStop(0.3, p.color + '4d'); // 30% opacity of key color
          flashGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = flashGrad;
          ctx.fill();
          
          ctx.restore();
          return true;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.alpha -= 0.038;

        if (p.alpha <= 0) return false;

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
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return true;
      });

      // 7. Update and Draw Floating Combo Text overlays
      stateRef.current.comboTexts = (stateRef.current.comboTexts || []).filter(ct => {
        ct.age += 1;
        ct.x += ct.vx;
        ct.y += ct.vy;
        ct.vy *= 0.985; // slight deceleration
        
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
        
        if (ct.alpha <= 0) return false;

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
        ctx.font = `italic 900 ${baseSize}px "Inter", sans-serif`;
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
          ctx.font = `italic 800 7.5px "Inter", sans-serif`;
          const subtextY = 9.5;
          
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.2;
          ctx.strokeText(ct.subtext, 0, subtextY);
          
          ctx.fillStyle = '#ffffff';
          ctx.fillText(ct.subtext, 0, subtextY);
        }
        
        ctx.restore();
        return true;
      });

      ctx.restore(); // Restore from screen shake translation

      // Repeat animation loop
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearInterval(clockInterval);
    };
  }, [isPlaying, soundEnabled]);

  // Handle pointer tracking inputs
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    stateRef.current.isMousePressed = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Track slash trail
    stateRef.current.trail.push({ x, y, age: 300 }); // trail holds for 300ms
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
      playWebSound('slash');
      stateRef.current.lastSlashSoundTime = now;
    }

    stateRef.current.lastX = x;
    stateRef.current.lastY = y;
  };

  const handlePointerUp = () => {
    stateRef.current.isMousePressed = false;
  };

  const handlePointerLeave = () => {
    stateRef.current.isMousePressed = false;
  };

  const handleHandCoordsTracked = (x: number, y: number, isEngaged: boolean) => {
    if (controlMode !== 'camera' || !isPlaying) return;

    stateRef.current.isMousePressed = true;
    
    // Smooth translation coordinates are already EMA-filtered by HandTracker relative to canvas client dimension boundary.
    stateRef.current.trail.push({ x, y, age: 320 });
    stateRef.current.totalSlashes += 1;

    // Record normalized slash history for Replays and Verification
    const canvas = canvasRef.current;
    if (canvas && stateRef.current.slashHistory) {
      const pctX = canvas.width > 0 ? x / canvas.width : 0.5;
      const pctY = canvas.height > 0 ? y / canvas.height : 0.5;
      const t = Date.now() - (stateRef.current.startTime || Date.now());
      stateRef.current.slashHistory.push({ x: pctX, y: pctY, t });
    }

    // Play wind speed swipe swoosh sound effect on fast speed tracking changes
    const dist = Math.hypot(x - stateRef.current.lastX, y - stateRef.current.lastY);
    const now = Date.now();
    if (dist > 16 && now - (stateRef.current.lastSlashSoundTime || 0) > 130) {
      playWebSound('slash');
      stateRef.current.lastSlashSoundTime = now;
    }

    stateRef.current.lastX = x;
    stateRef.current.lastY = y;
  };

  return (
    <div className="space-y-4 w-full">
      <div className={`relative w-full max-w-4xl mx-auto aspect-[16/9] bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col ${
        activeShake === 'intense' ? 'shake-intense' : activeShake === 'mild' ? 'shake-mild' : ''
      }`}>
      {/* HUD Header */}
      {isPlaying && (
        <div className="absolute top-0 inset-x-0 z-10 px-4 py-4 flex justify-between items-center bg-gradient-to-b from-slate-950/95 to-transparent pointer-events-none select-none">
        
        {/* Left indicators: Score & Lives */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Unified Score */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800/90 px-3 py-1.5 rounded-2xl shadow-md relative">
            <span className="text-xl">🍕</span>
            <div className="flex flex-col">
              <span className="text-[8px] uppercase tracking-wider text-amber-500 font-mono leading-none font-bold">Puntos</span>
              <span className="text-xl font-sans font-black text-white leading-none mt-0.5">{score}</span>
            </div>

            {/* Embedded Micro Combo Indicator - Space-saving and highly professional */}
            {ninjaCombo >= 2 && (
              <div className="absolute -bottom-2 right-1 translate-y-1/2 z-20 animate-bounce">
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black font-mono tracking-wider shadow-lg border flex items-center gap-0.5 whitespace-nowrap transition-all duration-300 ${
                  ninjaCombo >= 5
                    ? 'bg-yellow-500 text-slate-950 border-yellow-300'
                    : ninjaCombo >= 4
                      ? 'bg-rose-500 text-white border-rose-400'
                      : ninjaCombo >= 3
                        ? 'bg-orange-500 text-white border-orange-400'
                        : 'bg-amber-500 text-slate-950 border-amber-400'
                }`}>
                  <Zap className="w-2.5 h-2.5 animate-pulse fill-current" />
                  x{comboMultiplier} ({ninjaCombo})
                </span>
              </div>
            )}
          </div>

          {/* Lives list pill */}
          <div className="bg-slate-900/90 border border-slate-800/90 px-2.5 py-1.5 rounded-2xl shadow-md flex items-center gap-1.5">
            {[1, 2, 3].map((pizzaLifeId) => (
              <span
                key={pizzaLifeId}
                className={`transition-all duration-300 text-lg ${
                  lives >= pizzaLifeId 
                    ? 'opacity-100 scale-110 drop-shadow-[0_2px_6px_rgba(245,158,11,0.5)] animate-pulse' 
                    : 'opacity-20 grayscale scale-90'
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
          <div className="bg-slate-900/90 border border-slate-800/90 px-3 py-1.5 rounded-2xl flex items-center gap-1.5 font-mono shadow-md" title="Nivel de Horneo actual">
            <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse fill-amber-500/30" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Nivel:</span>
            <span className="font-extrabold text-xs text-amber-400">
              {Math.min(6, 1 + Math.floor((45 - timeLeft) / 8))}
            </span>
          </div>

          {/* Interactive Audio Controls Popover */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSoundSettings(!showSoundSettings);
                playWebSound('splat');
              }}
              className={`border p-2 rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center ${
                showSoundSettings
                  ? 'bg-amber-500 border-amber-400 text-slate-950 scale-105'
                  : 'bg-slate-900/90 hover:bg-slate-850 border-slate-800/90 text-slate-300'
              }`}
              title="Ajustes de Sonido"
            >
              {soundEnabled && globalVolume > 0 ? (
                globalVolume > 0.5 ? <Volume2 className="w-4 h-4" /> : <Volume1 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4 text-rose-400" />
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

          {/* Time Countdown */}
          <div className="bg-slate-900/90 border border-slate-800/90 px-3 py-1.5 rounded-2xl flex items-center gap-1.5 font-mono shadow-md">
            <CalendarClock className={`w-3.5 h-3.5 ${timeLeft <= 10 ? 'text-rose-400 animate-bounce' : 'text-slate-400'}`} />
            <span className={`font-black text-xs ${timeLeft <= 10 ? 'text-rose-400 font-black animate-scale-heartbeat' : 'text-slate-200'}`}>
              00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
            </span>
          </div>
        </div>
      </div>
    )}

      {/* Dynamic accuracy-based Combo Overlay */}
      <div className="absolute top-[72px] inset-x-0 z-10 flex flex-col items-center pointer-events-none select-none">
        <AnimatePresence>
          {comboDetails && (
            <motion.div
              key={`${comboDetails.count}-${comboDetails.timestamp}`}
              initial={{ scale: 0.3, y: -20, opacity: 0 }}
              animate={{
                scale: comboDetails.scale,
                y: 0,
                opacity: 1,
              }}
              exit={{ scale: 0.8, y: 10, opacity: 0 }}
              transition={{ type: "spring", stiffness: 450, damping: 15 }}
              className={`flex flex-col items-center justify-center p-3 px-5 rounded-2xl bg-slate-950/92 border border-slate-800/90 backdrop-blur-md ${comboDetails.shadowClass} gap-1 shadow-2xl relative border-t-amber-500/25`}
              style={{ transformOrigin: "center" }}
            >
              {/* Top Precision Badge */}
              <div className={`text-[10px] sm:text-[11px] font-black font-sans uppercase tracking-widest bg-gradient-to-r ${comboDetails.colorClasses} bg-clip-text text-transparent flex items-center gap-1`}>
                {comboDetails.text}
              </div>

              {/* Combo Slices & Multiplier Numbers */}
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-sans text-white tracking-tighter italic select-none drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]">
                  {comboDetails.count} <span className="text-xs font-semibold tracking-normal text-slate-400 not-italic uppercase">Cortes</span>
                </span>
                <span className={`text-2xl sm:text-3xl font-black font-mono italic tracking-tight bg-gradient-to-r ${comboDetails.colorClasses} bg-clip-text text-transparent drop-shadow-md`}>
                  x{Math.pow(2, Math.max(1, comboDetails.count - 1))}
                </span>
              </div>

              {/* Subtitle / Accuracy info */}
              <div className="text-[10px] font-extrabold font-mono tracking-wider text-slate-300 flex items-center gap-1.5 uppercase leading-none">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                <span>{comboDetails.subtext}</span>
              </div>

              {/* Dynamic Precision Progress Bar */}
              <div className="w-40 sm:w-44 h-1 bg-slate-900 rounded-full mt-1.5 overflow-hidden border border-slate-800/80">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${comboDetails.displayPercent}%` }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className={`h-full bg-gradient-to-r ${comboDetails.colorClasses}`}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Screen Canvas element */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="w-full flex-1 cursor-crosshair touch-none"
      />

      {/* Danger alert overlay when near death */}
      {lives === 1 && isPlaying && (
        <div className="absolute inset-0 border-4 border-rose-600/20 pointer-events-none animate-pulse flex items-center justify-center">
          <div className="absolute top-24 bg-rose-950/80 border border-rose-500/30 text-rose-300 text-[11px] font-mono px-3 py-1 rounded-full flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>ÚLTIMA VIDA - ¡ALERTA PIÑAS!</span>
          </div>
        </div>
      )}

      {/* Intro Overlay / Game Over Cover screen */}
      {!isPlaying && (
        <div className="absolute inset-0 bg-slate-950/94 backdrop-blur-md flex items-center justify-center p-3 select-none overflow-y-auto">
          <div className="w-full max-w-3xl my-auto py-2">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              
              {/* Left Column: Game Title & Knife Selector Customizer */}
              <div className="flex flex-col justify-between bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl">
                
                {/* Title and game introduction */}
                <div className="text-center md:text-left">
                  <div className="flex items-center gap-3 justify-center md:justify-start mb-2.5">
                    <div className="relative inline-block shrink-0">
                      <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-indigo-500 via-rose-500 to-amber-500 blur-sm opacity-70 animate-pulse" />
                      <div className="relative bg-slate-950 text-2xl p-2 rounded-xl flex items-center justify-center border border-slate-800/80">
                        🍕🥷
                      </div>
                    </div>
                    <div>
                      <h1 className="text-lg sm:text-xl font-sans font-black text-white tracking-tight leading-none">Pizza Ninja</h1>
                      <span className="text-[10px] font-mono font-bold text-amber-500/90 uppercase tracking-wider block mt-0.5">Don Pizzero Edition</span>
                    </div>
                  </div>
                  
                  <p className="text-slate-300 text-[11px] leading-relaxed max-w-sm mb-4">
                    ¡Mamma mia! Las pizzas saltan calientes del horno. ¡Deberás cortarlas en rebanadas perfectas antes de que caigan sobre la mesa!
                  </p>
                </div>

                {/* Score badge from last game (conditional) */}
                {score > 0 && (
                  <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-xl px-4 py-2 mb-4 flex items-center justify-between text-[11px] font-semibold text-amber-300">
                    <span className="flex items-center gap-1.5 font-sans">
                      <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-500/25" /> Última Tanda:
                    </span>
                    <span className="font-mono text-white text-xs font-black">{score} PIXEL PTS</span>
                  </div>
                )}

                {/* Custom Blade Customization Boutique panel */}
                <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-xl text-left mt-auto">
                  <span className="text-[9px] font-mono font-bold text-rose-500 uppercase tracking-widest block mb-1.5 text-center">
                    🗡️ Elige tu Cuchillo de Chef:
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'fire', label: 'Fuego', icon: '🔥', color: 'border-orange-500 text-orange-400 bg-orange-500/10' },
                      { id: 'cyber', label: 'Cyber', icon: '⚡', color: 'border-cyan-500 text-cyan-400 bg-cyan-500/10' },
                      { id: 'basil', label: 'Pesto', icon: '🌿', color: 'border-green-500 text-green-400 bg-green-500/10' },
                      { id: 'gold', label: 'Oro', icon: '👑', color: 'border-yellow-500 text-yellow-400 bg-yellow-400/10' }
                    ].map((item) => {
                      const isActive = bladeStyle === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setBladeStyle(item.id as any);
                            playWebSound('splat');
                          }}
                          className={`p-1.5 rounded-lg border text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                            isActive
                              ? `bg-slate-950 ${item.color} shadow-[0_0_8px_rgba(239,68,68,0.2)] scale-105 font-bold`
                              : 'border-slate-800 bg-slate-900/30 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                          }`}
                          type="button"
                        >
                          <span className="text-sm">{item.icon}</span>
                          <span className="text-[8px] uppercase tracking-wider font-mono font-bold leading-none">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Control Modality Selector */}
                <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-xl text-left mt-3">
                  <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest block mb-1.5 text-center">
                    🕹️ Método de Interacción:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setControlMode('mouse');
                        playWebSound('splat');
                      }}
                      className={`p-1.5 rounded-lg border text-center transition-all duration-150 cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                        controlMode === 'mouse'
                          ? 'bg-slate-950 border-amber-500 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)] font-bold scale-[1.02]'
                          : 'border-slate-800 bg-slate-900/40 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <span className="text-xs">🖱️ Táctil / Ratón</span>
                      <span className="text-[7px] font-mono opacity-80 uppercase leading-none">Interacción Básica</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setControlMode('camera');
                        playWebSound('splat');
                      }}
                      className={`p-1.5 rounded-lg border text-center transition-all duration-150 cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                        controlMode === 'camera'
                          ? 'bg-slate-950 border-emerald-500 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)] font-bold scale-[1.02]'
                          : 'border-slate-800 bg-slate-900/40 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <span className="text-xs">👁️ Sensor Óptico</span>
                      <span className="text-[7px] font-mono opacity-80 uppercase leading-none">MediaPipe Cámara</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Recipe instructions and direct actions */}
              <div className="bg-slate-900/90 border border-slate-800/90 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-widest block mb-3 text-center">
                    📋 Receta del Don Pizzero:
                  </span>
                  
                  <div className="grid grid-cols-1 gap-2.5 text-[11px] text-slate-300 pb-4">
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none shrink-0">🍕</span>
                      <span><strong>Pizza Entera:</strong> 1 corte directo la divide en 2 mitades más pequeñas.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none shrink-0">🔪</span>
                      <span><strong>Mitades de Pizza:</strong> 1 corte las separa de forma limpia en deliciosas rebanadas.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none shrink-0">🍍</span>
                      <span><strong>Piña / Quemadas:</strong> ¡Prohibidas! Pierdes 1 vida al tocarlas e incendian todo.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none shrink-0">⚡</span>
                      <span><strong>Dificultad Dinámica:</strong> El horno de pizza acelera automáticamente.</span>
                    </div>
                  </div>

                  {/* Music theme and global sound adjustment boutique */}
                  <div className="border-t border-slate-800/80 pt-3.5 mt-2.5 space-y-3.5">
                    <span className="text-[10px] font-mono font-bold text-rose-500 uppercase tracking-widest block text-center">
                      🎶 Banda Sonora y Volumen:
                    </span>
                    
                    {/* Theme selector */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setMusicTheme('italian');
                          playWebSound('splat');
                        }}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                          musicTheme === 'italian'
                            ? 'bg-slate-950 border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)] font-bold scale-[1.02]'
                            : 'border-slate-800 bg-slate-900/40 text-slate-550 hover:border-slate-700 hover:text-slate-300'
                        }`}
                      >
                        <span className="text-base">🪗</span>
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase tracking-wider font-mono font-bold leading-none">Tarantella</span>
                          <span className="text-[7px] text-slate-500 mt-0.5 leading-none">Clásica Italiana</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMusicTheme('synthwave');
                          playWebSound('splat');
                        }}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                          musicTheme === 'synthwave'
                            ? 'bg-slate-950 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)] font-bold scale-[1.02]'
                            : 'border-slate-800 bg-slate-900/40 text-slate-550 hover:border-slate-700 hover:text-slate-300'
                        }`}
                      >
                        <span className="text-base">⚡</span>
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase tracking-wider font-mono font-bold leading-none">Synthwave</span>
                          <span className="text-[7px] text-slate-500 mt-0.5 leading-none">Vibe Ochentero</span>
                        </div>
                      </button>
                    </div>

                    {/* Volume slider with instant status */}
                    <div className="bg-slate-950/70 border border-slate-850 p-2 rounded-xl flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSoundEnabled(!soundEnabled);
                          playWebSound('splat');
                        }}
                        className="text-slate-400 hover:text-white transition shrink-0 cursor-pointer animate-pulse"
                        title={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
                      >
                        {soundEnabled && globalVolume > 0 ? (
                          globalVolume > 0.5 ? <Volume2 className="w-3.5 h-3.5 text-amber-500" /> : <Volume1 className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={globalVolume}
                        onChange={(e) => setGlobalVolume(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500 focus:outline-none"
                      />
                      <span className="font-mono text-[9px] text-slate-400 font-bold shrink-0 w-8 text-right">
                        {soundEnabled ? `${Math.round(globalVolume * 100)}%` : 'MUTED'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={startGame}
                  className="w-full bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 hover:from-amber-600 hover:via-rose-600 hover:to-rose-500 text-white text-xs sm:text-sm font-black py-3 px-5 rounded-xl shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group cursor-pointer mt-2"
                >
                  <Play className="w-4 h-4 fill-current text-white animate-pulse shrink-0" />
                  <span className="tracking-wider uppercase">{score > 0 ? '¡Hornear otra Tanda!' : '¡Comenzar el Horneo!'}</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}
      </div>

      {/* Control Panel Console (MediaPipe Webcam feedback) */}
      <AnimatePresence>
        {controlMode === 'camera' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="w-full max-w-4xl mx-auto"
          >
            <HandTracker
              onCoordsTracked={handleHandCoordsTracked}
              canvasWidth={canvasRef.current?.width || 800}
              canvasHeight={canvasRef.current?.height || 450}
              isEnabled={controlMode === 'camera'}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
