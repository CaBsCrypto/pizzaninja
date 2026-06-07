import React, { useEffect, useRef, useState } from 'react';
import { 
  Camera as CameraIcon, 
  Shield, 
  Laptop, 
  Check, 
  X, 
  Sliders, 
  Play, 
  Settings2, 
  RefreshCw, 
  ArrowRight, 
  Info, 
  ExternalLink, 
  HelpCircle,
  Terminal,
  RefreshCcw,
} from 'lucide-react';

import { gameSocket } from '../services/websocket';

const mediaPipePrintErr = (msg: any, ...args: any[]) => {
  
  // Detect informational or warning glogs, or successfully/inactive WebGL statuses
  const isInfo = /^[IWD]\d{4}\s+/.test(fullMsg) || 
                 fullMsg.includes('gl_context_webgl.cc') || 
                 fullMsg.includes('gl_context.cc') ||
                 fullMsg.includes('Successfully created') ||
                 fullMsg.includes('Successfully destroyed') ||
                 fullMsg.includes('GL version') ||
                 fullMsg.includes('OpenGL error checking is disabled') ||
                 fullMsg.includes('warning: you defined Module.locateFilePackage');

  if (isInfo) {
    if (fullMsg.startsWith('W')) {
      console.warn('[MediaPipe Info/Warning]', fullMsg, ...args);
    } else {
      console.info('[MediaPipe Info]', fullMsg, ...args);
    }
  } else {
    console.error('[MediaPipe]', fullMsg, ...args);
  }
};

interface HandTrackerProps {
  onCoordsTracked: (x: number, y: number, handIdx: number, isEngaged: boolean) => void;
  canvasWidth: number;
  canvasHeight: number;
  isEnabled: boolean;
  onStatusChange?: (status: 'inactive' | 'loading' | 'active' | 'error', errorMsg?: string) => void;
  onFallbackToMouse?: () => void;
  isCompact?: boolean;
  onHandPresenceChange?: (detected: boolean) => void;
}

export default function HandTracker({
  onCoordsTracked,
  canvasWidth,
  canvasHeight,
  isEnabled,
  onStatusChange,
  onFallbackToMouse,
  isCompact = false,
  onHandPresenceChange
}: HandTrackerProps) {
  // Config & Status States
  const [sourceType, setSourceType] = useState<'local' | 'cdn'>('cdn'); // Highly reliable CDN by default, local as backup
  const [cdnStatus, setCdnStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [modelStatus, setModelStatus] = useState<'off' | 'starting' | 'active' | 'error'>('off');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [handDetected, setHandDetected] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(true);

  // Notify parent component about hand detection status changes
  useEffect(() => {
    onHandPresenceChange?.(handDetected);
  }, [handDetected, onHandPresenceChange]);

  // Stats Counters
  const [frameCount, setFrameCount] = useState(0);
  const [lastFrameTime, setLastFrameTime] = useState<string>('');
  
  // Advanced Calibration
  const [smoothingFactor, setSmoothingFactor] = useState(0.50); // PERF: 0.50 is much snappier than 0.24, reducing input lag
  const [mirrorX, setMirrorX] = useState(true);
  const [detectionConfidence, setDetectionConfidence] = useState(0.40);

  // Camera Devices Listing
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handsInstanceRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIdRef = useRef<number | null>(null);

  // CRITICAL: isEnabledRef keeps the tick loop always reading the LATEST isEnabled value
  // without this, the async tick closure captures a stale value and can't exit cleanly,
  // causing MediaPipe to keep sending frames to a destroyed/closed instance (crash).
  const isEnabledRef = useRef(isEnabled);
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  // Smoothing ref - always latest value in async tick closure
  const smoothingFactorRef = useRef(smoothingFactor);
  useEffect(() => {
    smoothingFactorRef.current = smoothingFactor;
  }, [smoothingFactor]);

  const mirrorXRef = useRef(mirrorX);
  useEffect(() => {
    mirrorXRef.current = mirrorX;
  }, [mirrorX]);

  // CRITICAL: onCoordsTrackedRef keeps handleResults always calling the LATEST prop.
  // MediaPipe's hands.onResults() captures the function ref at setup time, so without this,
  // handleResults calls the old onCoordsTracked where isPlaying/countdown are stale —
  // this is why slicing and auto-start stopped working after PizzaCanvas re-renders.
  const onCoordsTrackedRef = useRef(onCoordsTracked);
  onCoordsTrackedRef.current = onCoordsTracked; // update synchronously every render

  // PERF: Offscreen canvas for scaling video to 320x240 before MediaPipe inference
  const scaleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Dual-hand EMA Coordinates Storage (index 0 = hand 0, index 1 = hand 1)
  const lastXRef = useRef<(number | null)[]>([null, null]);
  const lastYRef = useRef<(number | null)[]>([null, null]);

  // PERF: Frame throttle ref -- only fire React setState every N frames
  // to avoid expensive re-renders on every ~30fps MediaPipe callback
  const frameTickRef = useRef(0);

  // Custom logging utility
  const addLog = (msg: string) => {
    console.log(`[HandTracker] ${msg}`);
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-14), `[${time}] ${msg}`]);
  };

  // Protect window.createMediapipeSolutionsPackedAssets from being overwritten and losing dataFileDownloads metadata (React StrictMode fix)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const AnyWindow = window as any;
      if (!AnyWindow.__packedAssetsObserverSet) {
        AnyWindow.__packedAssetsObserverSet = true;
        let originalValue = AnyWindow.createMediapipeSolutionsPackedAssets;
        
        // Setup initial console bindings on the window object if not present
        if (originalValue) {
          originalValue.print = originalValue.print || console.log.bind(console);
          originalValue.printErr = originalValue.printErr || mediaPipePrintErr;
        }

        Object.defineProperty(AnyWindow, 'createMediapipeSolutionsPackedAssets', {
          configurable: true,
          enumerable: true,
          get() {
            return originalValue;
          },
          set(newVal) {
            if (originalValue && newVal) {
              originalValue = {
                ...originalValue,
                ...newVal,
                dataFileDownloads: originalValue.dataFileDownloads || newVal.dataFileDownloads,
                expectedDataFileDownloads: originalValue.expectedDataFileDownloads || newVal.expectedDataFileDownloads,
                print: originalValue.print || newVal.print || console.log.bind(console),
                printErr: originalValue.printErr || newVal.printErr || mediaPipePrintErr,
              };
            } else {
              if (newVal) {
                newVal.print = newVal.print || console.log.bind(console);
                newVal.printErr = newVal.printErr || mediaPipePrintErr;
              }
              originalValue = newVal;
            }
          }
        });
      }
    }
  }, []);

  // 1. Check & Populate video devices
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devs => {
          const videoDevs = devs.filter(d => d.kind === 'videoinput');
          setDevices(videoDevs);
          if (videoDevs.length > 0 && !selectedDeviceId) {
            // Pick first device as default
            setSelectedDeviceId(videoDevs[0].deviceId);
            addLog(`Dispositivos de video encontrados: ${videoDevs.length}. Seleccionado: ${videoDevs[0].label || 'Cámara Principal'}`);
          }
        })
        .catch(err => {
          addLog(`Error al enumerar dispositivos: ${err.message}`);
        });
    }
  }, [modelStatus]);

  // 2. Trigger script injection when enabled or when sourceType changes
  useEffect(() => {
    if (!isEnabled) {
      handleStopTracking();
      return;
    }

    addLog(`Detección Óptica Activada (Modo 1 Mano). Iniciando en modo: ${sourceType.toUpperCase()}`);
    setCdnStatus('loading');
    if (onStatusChange) onStatusChange('loading');

    const injectScripts = async () => {
      try {
        if (sourceType === 'local') {
          addLog("Intentando cargar libs locales desde '/mediapipe/'...");
          await loadScript('/mediapipe/camera_utils.js');
          await loadScript('/mediapipe/hands.js');
        } else {
          addLog("Intentando cargar libs estables desde CDN (jsdelivr@0.4.1646424915)...");
          await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js');
          await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js');
        }
        
        addLog("Scripts cargados con éxito. Instanciando pipeline de detección dual...");
        setCdnStatus('loaded');
        handleStartTracking();
      } catch (err: any) {
        addLog(`ERROR al inyectar scripts en modo ${sourceType.toUpperCase()}: ${err.message || err}`);
        
        // Automatic Fallback
        if (sourceType === 'local') {
          addLog("FALLBACK ACTIVO: Cambiando automáticamente a la CDN de Google...");
          setSourceType('cdn');
        } else {
          setCdnStatus('error');
          const errFriendly = "Error de Red: No se pudo conectar con la CDN ni el servidor local para cargar MediaPipe.";
          setErrorMessage(errFriendly);
          if (onStatusChange) onStatusChange('error', errFriendly);
        }
      }
    };

    injectScripts();
  }, [isEnabled, sourceType]);

  // 3. Dynamic Model Options Update on Calibrator Change
  useEffect(() => {
    if (isEnabled && cdnStatus === 'loaded' && handsInstanceRef.current) {
      try {
        handsInstanceRef.current.setOptions({
          maxNumHands: 1,
          modelComplexity: 0,  // PERF: lite model (0) is 2x faster than full (1)
          minDetectionConfidence: detectionConfidence,
          minTrackingConfidence: 0.65  // PERF: higher = fewer expensive re-detects,
        });
        addLog(`Calibración del modelo actualizada (Confianza mínima: ${detectionConfidence})`);
      } catch (err: any) {
        console.warn("Fallo al actualizar opciones del modelo:", err);
      }
    }
  }, [detectionConfidence, isEnabled, cdnStatus]);

  // 4. Auto-clean-up on unmount
  useEffect(() => {
    return () => {
      handleStopTracking();
    };
  }, []);

  // Script Loader Helper
  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`No se pudo descargar el recurso: ${src}`));
      document.head.appendChild(script);
    });
  };

  // Start Camera and Instantiate tracker
  const handleStartTracking = async () => {
    if (typeof window === 'undefined') return;
    
    const AnyWindow = window as any;
    if (!AnyWindow.Hands) {
      addLog("MediaPipe global 'Hands' ausente en window. Esperando inicialización (500ms)...");
      setTimeout(handleStartTracking, 500);
      return;
    }

    setModelStatus('starting');
    if (onStatusChange) onStatusChange('loading');

    try {
      // Clean previous instances
      if (handsInstanceRef.current) {
        try { handsInstanceRef.current.close(); } catch (e) {}
        handsInstanceRef.current = null;
      }

      // Cancel any previous RAF loop
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }

      addLog("Creando nueva instancia de MediaPipe Hands (1 mano)...");
      const hands = new AnyWindow.Hands({
        locateFile: (file: string) => {
          const resolvedPath = sourceType === 'local' 
            ? `/mediapipe/${file}`
            : `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
          return resolvedPath;
        },
        print: console.log.bind(console),
        printErr: mediaPipePrintErr
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,  // PERF: lite model (0) is 2x faster than full (1)
        minDetectionConfidence: detectionConfidence,
        minTrackingConfidence: 0.40  // PERF: low threshold = extremely sticky tracking, far fewer expensive re-detects
      });

      hands.onResults(handleResults);
      handsInstanceRef.current = hands;
      addLog("Instancia Hands (1 mano) vinculada con éxito.");

      // Check for video element
      if (!videoRef.current) {
        throw new Error("El nodo reproductor de Video no está asignado en el DOM.");
      }

      // Build constraints
      // PERF: Requesting 640x480 gives a good FOV without forcing standard webcams
      // to drop their framerate in low-light conditions (which happens at 720p/1080p).
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640, max: 640 }, height: { ideal: 480, max: 480 }, frameRate: { ideal: 60, min: 30 } }
          : { facingMode: "user", width: { ideal: 640, max: 640 }, height: { ideal: 480, max: 480 }, frameRate: { ideal: 60, min: 30 } },
        audio: false
      };

      addLog(`Solicitando permisos para Capturador de Video (ID: ${selectedDeviceId || 'Predeterminado'})...`);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        addLog("Acceso a Cámara CONCEDIDO.");
      } catch (camErr: any) {
        addLog(`Acceso ideal fallido (${camErr.name}). Probando acceso de respaldo básico...`);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        addLog("Acceso de respaldo básico CONCEDIDO.");
      }

      // Exit if user turned off model while permission modal was active
      if (!videoRef.current || !isEnabledRef.current) {
        addLog("Detección suspendida post-aprobación del usuario.");
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      // Explicitly set playsinline and muted attributes directly on the DOM element for absolute iOS Safari safety
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('webkit-playsinline', 'true');
      videoRef.current.setAttribute('muted', 'true');
      videoRef.current.setAttribute('autoplay', 'true');
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      try {
        videoRef.current.load();
        await videoRef.current.play();
        addLog(`Reproductor de video activo. Resolucion actual: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
      } catch (pErr) {
        addLog(`Aviso de reproducción: Asegura permisos de autoplay/silencio (${pErr})`);
      }

      // Reset EMA state for both hands
      lastXRef.current = [null, null];
      lastYRef.current = [null, null];

      // Launch custom optimized tracking loop (requestVideoFrameCallback)
      // IMPORTANT: Use isEnabledRef.current (NOT isEnabled prop) to avoid stale closure crash
      let isProcessing = false;
      addLog("Iniciando bucle de escaneo optimizado...");

      const tick = async (now?: number, metadata?: any) => {
        // CRITICAL: Read from ref, not from closed-over isEnabled prop
        if (!isEnabledRef.current || !handsInstanceRef.current || !videoRef.current) {
          return; // Exit loop cleanly
        }

        if (videoRef.current.paused || videoRef.current.ended) {
          scheduleNextTick();
          return;
        }

        // We use isProcessing to ensure we don't stack multiple inference calls
        if (!isProcessing) {
          isProcessing = true;
          try {
            // PERF: Send videoElement directly to MediaPipe. 
            // This allows MediaPipe to pull the frame straight to the GPU via WebGL,
            // avoiding massive CPU rasterization overhead from a 2D canvas copy.
            await handsInstanceRef.current.send({ image: videoRef.current });
          } catch (sendErr) {
            // Prevent spamming logs on every skipped frame
            console.warn("MediaPipe tick sync skip:", sendErr);
          } finally {
            isProcessing = false;
          }
        }

        // Continue only if still enabled
        if (isEnabledRef.current) {
          scheduleNextTick();
        }
      };

      const scheduleNextTick = () => {
        if (!videoRef.current) return;
        const vid = videoRef.current as any;
        if ('requestVideoFrameCallback' in vid) {
          frameIdRef.current = vid.requestVideoFrameCallback(tick);
        } else {
          frameIdRef.current = requestAnimationFrame(() => tick());
        }
      };

      scheduleNextTick();
      setModelStatus('active');
      if (onStatusChange) onStatusChange('active');
      setErrorMessage(null);
      addLog("¡SENSOR ÓPTICO TOTALMENTE EN LÍNEA!");
    } catch (err: any) {
      addLog(`FALLO CRÍTICO de Inicialización: ${err.name || err.message}`);
      console.error(err);
      setModelStatus('error');
      
      let friendlyStr = err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError' || err.message?.includes('denied')
        ? "Permiso denegado por el navegador. Concede acceso a la cámara."
        : `Error del sensor óptico: ${err.message || err.name || err}`;
      
      setErrorMessage(friendlyStr);
      if (onStatusChange) onStatusChange('error', friendlyStr);
    }
  };

  const handleStopTracking = () => {
    addLog("Apagando sensor de forma segura...");
    
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          addLog("Canal de cámara cerrado.");
        });
      } catch (e) {}
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (handsInstanceRef.current) {
      try {
        handsInstanceRef.current.close();
        addLog("Instancia de MediaPipe eliminada.");
      } catch (e) {}
      handsInstanceRef.current = null;
    }

    setModelStatus('off');
    setHandDetected(false);
    if (onStatusChange) onStatusChange('inactive');

    lastXRef.current = [null, null];
    lastYRef.current = [null, null];
    addLog("Sensor apagado.");
  };

  // Process Landmarks - supports up to 2 hands
  const handleResults = (results: any) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      if (handDetected) {
        addLog("Mano(s) fuera del área de escaneo.");
        setHandDetected(false);
      }
      // Dispatch disengage for both hands when no hands visible
      onCoordsTrackedRef.current(0, 0, 0, false);
      onCoordsTrackedRef.current(0, 0, 1, false);
      return;
    }

    if (!handDetected) {
      addLog(`¡MANO(S) ENCONTRADA(S)! (${results.multiHandLandmarks.length}). Iniciando rastreo dual...`);
      setHandDetected(true);
    }

    // Stats updates — throttled to every 15 frames to avoid per-frame re-renders
    // PERF: NEVER trigger React setState re-renders while the user is playing (isCompact = true)
    if (!isCompact) {
      frameTickRef.current = (frameTickRef.current + 1) % 15;
      if (frameTickRef.current === 0) {
        setFrameCount(f => f + 1);
        setLastFrameTime(new Date().toLocaleTimeString());
      }
    }

    // Process each detected hand (up to 2)
    const numHands = Math.min(results.multiHandLandmarks.length, 2);
    const activeIndices = new Set<number>();
    
    for (let handIdx = 0; handIdx < numHands; handIdx++) {
      const landmarks = results.multiHandLandmarks[handIdx];
      const indexTip = landmarks[8]; // INDEX_FINGER_TIP

      // Use handedness classification to assign hand index consistently if available
      // MediaPipe labels Right/Left from the model's perspective (mirrored)
      let preferredIdx = handIdx;
      if (results.multiHandedness && results.multiHandedness[handIdx]) {
        // 'Right' from MediaPipe = user's Left hand (camera mirror) -> idx 0
        // 'Left'  from MediaPipe = user's Right hand (camera mirror) -> idx 1
        const label = results.multiHandedness[handIdx].label;
        preferredIdx = label === 'Right' ? 0 : 1;
      }

      // Ensure unique index per frame (avoid two hands fighting for index 0 or 1)
      let assignedHandIdx = preferredIdx;
      if (activeIndices.has(assignedHandIdx)) {
        assignedHandIdx = assignedHandIdx === 0 ? 1 : 0; // fallback to the other slot
      }
      activeIndices.add(assignedHandIdx);

      let normX = indexTip.x;
      if (mirrorXRef.current) {
        normX = 1 - normX;
      }
      const normY = indexTip.y;

      // Exponential Moving Average (EMA) per hand using normalized coords
      let finalX = normX;
      let finalY = normY;
      const alpha = smoothingFactorRef.current;
      const prevX = lastXRef.current[assignedHandIdx];
      const prevY = lastYRef.current[assignedHandIdx];

      if (prevX !== null && prevY !== null) {
        finalX = prevX + alpha * (normX - prevX);
        finalY = prevY + alpha * (normY - prevY);
        
        // PERF: Se eliminó el envío de WebSocket de aquí. 
        // ¡Estábamos saturando la red y el Garbage Collector mandando 60-120 mensajes JSON por segundo!
        // Ahora es PizzaCanvas quien envía el corte al backend SOLO cuando impacta con una pizza.
      }

      lastXRef.current[assignedHandIdx] = finalX;
      lastYRef.current[assignedHandIdx] = finalY;

      onCoordsTrackedRef.current(finalX, finalY, assignedHandIdx, true);

      // Draw full cyber-skeleton feedback (throttled: every 2nd frame saves ~50% draw calls)
      if (frameTickRef.current % 2 === 0) {
        // Draw cyber-skeleton feedback for this hand
        const handColor = assignedHandIdx === 0 ? '#10b981' : '#f59e0b'; // Green hand0, Amber hand1
        const tipColor  = assignedHandIdx === 0 ? '#f43f5e' : '#06b6d4'; // Red tip0, Cyan tip1
  
        ctx.strokeStyle = handColor;
        ctx.lineWidth = 1.5;

        const connect = (indices: number[]) => {
          ctx.beginPath();
          indices.forEach((idx, i) => {
            const pt = landmarks[idx];
            const cx = (mirrorXRef.current ? 1 - pt.x : pt.x) * canvas.width;
            const cy = pt.y * canvas.height;
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          });
          ctx.stroke();
        };

        connect([0, 1, 2, 3, 4]); // Thumb
        connect([0, 5, 6, 7, 8]); // Index
        connect([9, 10, 11, 12]); // Middle
        connect([13, 14, 15, 16]); // Ring
        connect([0, 17, 18, 19, 20]); // Pinky
        connect([5, 9, 13, 17]); // Palm

        // Draw nodes
        landmarks.forEach((pt: any, idx: number) => {
          const cx = (mirrorXRef.current ? 1 - pt.x : pt.x) * canvas.width;
          const cy = pt.y * canvas.height;
          ctx.beginPath();
          ctx.arc(cx, cy, idx === 8 ? 6 : 2.5, 0, Math.PI * 2);
          ctx.fillStyle = idx === 8 ? tipColor : handColor;
          ctx.fill();
        });
      }
    }

    // Dispatch disengage for hand indices that were NOT detected in this frame
    for (let i = 0; i < 2; i++) {
      if (!activeIndices.has(i)) {
        // Reset EMA for this hand slot since it's gone
        lastXRef.current[i] = null;
        lastYRef.current[i] = null;
        onCoordsTrackedRef.current(0, 0, i, false);
      }
    }
  };

  // Switch camera manual handler
  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const devId = e.target.value;
    setSelectedDeviceId(devId);
    addLog(`Cambiando dispositivo de cámara a: ${devId}`);
    if (isEnabled && modelStatus === 'active') {
      // Hot-restart tracking to bind new stream
      setTimeout(() => {
        handleStopTracking();
        handleStartTracking();
      }, 100);
    }
  };

  return (
    <div
      id={isCompact ? undefined : "optical-tracker-panel"}
      className={
        isCompact
          ? `relative w-full h-full rounded-2xl overflow-hidden border-2 shadow-2xl flex items-center justify-center bg-slate-950 transition-all duration-300 ${
              modelStatus === 'active'
                ? handDetected
                  ? 'border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.35)] bg-slate-950/60'
                  : 'border-amber-500/70 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse'
                : 'border-slate-800 animate-pulse'
            }`
          : "bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-5"
      }
    >
      {/* Laser header border (Full Mode Only) */}
      {!isCompact && (
        <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent animate-pulse z-10 pointer-events-none" />
      )}

      {/* Main HUD Title (Full Mode Only, spans 12 columns) */}
      {!isCompact && (
        <div className="md:col-span-12 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800/80 pb-4 mb-1 gap-3 relative z-20">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
              modelStatus === 'active' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]' 
                : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
            }`}>
              <CameraIcon className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-sm text-white tracking-tight flex items-center gap-2">
                Consola de Calibración Óptica — 1 Mano
                {modelStatus === 'active' && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">DETECCIÓN DE 1 MANO · AUDITORÍA EN VIVO</p>
            </div>
          </div>

          {/* Toggle Panel Controls */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex-1 sm:flex-initial flex items-center justify-center gap-1.5 ${
                showDiagnostics 
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' 
                  : 'bg-slate-950 border-slate-900 text-slate-500'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Terminal</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex-1 sm:flex-initial flex items-center justify-center gap-1.5 ${
                showConfig 
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                  : 'bg-slate-950 border-slate-900 text-slate-500'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Filtros</span>
            </button>
          </div>
        </div>
      )}

      {/* Unified Video and Canvas Wrapper */}
      <div
        className={
          isCompact
            ? "absolute inset-0 w-full h-full z-10"
            : "md:col-span-5 relative w-full aspect-[4/3] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center z-10"
        }
      >
        {/* Realtime Video Frame */}
        <video
          ref={videoRef}
          width={640}
          height={480}
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          style={{ transform: mirrorX ? 'scaleX(-1)' : 'none' }}
          playsInline
          muted
          autoPlay
        />

        {/* Cyan Skeleton Overlay */}
        <canvas
          ref={overlayCanvasRef}
          width={320}
          height={240}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Floating status alert overlaid in both modes */}
        {modelStatus === 'active' && !handDetected && (
          <div className="absolute inset-x-0 bottom-4 mx-auto w-fit bg-slate-950/90 border border-amber-500/30 text-[9px] font-mono text-amber-400 px-3 py-1 rounded-full z-20 flex items-center justify-center gap-1.5 animate-pulse shadow-md">
            <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-ping"></span>
            <span>MUESTRA TU MANO FRENTE A LA PANTALLA</span>
          </div>
        )}

        {/* Compact Micro HUD Overlay (Compact Mode Only) */}
        {isCompact && (
          <div className="absolute top-2 left-2 z-25 flex items-center gap-1 bg-slate-950/90 px-1.5 py-0.5 rounded border border-slate-800/80 font-mono text-[7px] font-bold text-white tracking-wider">
            <span className={`h-1 w-1 rounded-full ${
              modelStatus === 'active'
                ? handDetected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                : 'bg-slate-500'
            }`} />
            <span>{modelStatus === 'active' ? (handDetected ? 'MANO OK' : 'MANO ?') : 'SIN SENSOR'}</span>
          </div>
        )}

        {/* Black-screen HUDs (Full Mode Only) */}
        {!isCompact && modelStatus === 'off' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-20 bg-slate-950/90">
            <Video className="w-9 h-9 text-slate-500 mb-2 animate-bounce" />
            <span className="text-xs text-slate-300 font-bold font-sans uppercase">
              Cámara Desconectada
            </span>
            <span className="text-[9px] text-slate-500 mt-1 max-w-[220px] leading-relaxed">
              Activa el "Sensor Óptico" en la consola superior del juego para iniciar el reconocimiento.
            </span>
          </div>
        )}

        {modelStatus === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-20 bg-slate-950/95">
            <RefreshCcw className="w-8 h-8 text-amber-400 animate-spin mb-3" />
            <span className="text-[10px] font-mono text-amber-300 font-bold uppercase tracking-widest leading-none">
              Inicializando Pipeline Dual
            </span>
            <p className="text-[9px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">
              Cargando librerías WebAssembly y abriendo sensor local...
            </p>
          </div>
        )}

        {modelStatus === 'active' && handDetected && !isCompact && (
          <div className="absolute top-4 left-4 bg-emerald-950/90 border border-emerald-500/40 text-[9px] font-mono text-emerald-400 px-2.5 py-1 rounded-lg z-20 flex items-center gap-1.5 font-bold shadow-md">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>DIAGRAMA ACTIVO</span>
          </div>
        )}

        {modelStatus === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-20 bg-rose-950/95">
            <X className="w-9 h-9 text-rose-500 mb-2" />
            <span className="text-xs text-rose-300 font-bold uppercase tracking-wider font-mono">
              Error de Inicialización
            </span>
            <p className="text-[9.5px] text-slate-400 mt-1.5 max-w-[230px] leading-relaxed">
              {errorMessage || "Acceso bloqueado o hardware no disponible. Usando mouse en reversa."}
            </p>
            {onFallbackToMouse && (
              <button
                type="button"
                onClick={onFallbackToMouse}
                className="mt-4 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-mono text-[9px] font-black uppercase tracking-wider rounded-lg transition duration-150 cursor-pointer shadow-lg border border-rose-450/30 flex items-center gap-1"
              >
                <span>Filtro de Emergencia: Ratón</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Info Box (Full Mode Only) */}
      {!isCompact && (
        <div className="md:col-span-5 flex flex-col gap-2 w-full bg-slate-950/50 border border-slate-850 p-3 rounded-2xl z-20 relative">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Dispositivo de Entrada:</span>
            <Video className="w-3.5 h-3.5 text-slate-500" />
          </div>
          
          <select
            value={selectedDeviceId}
            onChange={handleCameraChange}
            className="w-full text-[10px] bg-slate-950 border border-slate-800 text-slate-300 rounded-lg py-1.5 px-2 outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/20 font-mono cursor-pointer"
          >
            <option value="">-- Cámara Predeterminada --</option>
            {devices.map((device, index) => (
              <option key={device.deviceId || index} value={device.deviceId}>
                {device.label || `Cámara Secundaria (${index + 1})`}
              </option>
            ))}
          </select>

          {/* Dual hand color legend */}
          <div className="flex items-center gap-3 mt-1 pt-2 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5 text-[8px] font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              <span>Mano Izq. (Verde)</span>
            </div>
            <div className="flex items-center gap-1.5 text-[8px] font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
              <span>Mano Der. (Ámbar)</span>
            </div>
          </div>
        </div>
      )}

      {/* Right Column Diagnostic Console / Logs / Configurations (Full Mode Only) */}
      {!isCompact && (
        <div className="md:col-span-7 flex flex-col justify-between space-y-4 z-20 relative">
          
          {/* Diagnostic Stats Overlay Grid */}
          <div className="grid grid-cols-2 shadow-inner sm:grid-cols-4 gap-2 bg-slate-950/80 border border-slate-850 p-2.5 rounded-2xl font-mono text-[9px]">
            <div className="bg-slate-900/40 p-1.5 rounded-lg border border-slate-850 text-center">
              <span className="text-slate-500 uppercase block text-[7.5px]">Script Core</span>
              <span className={`font-semibold tracking-wider ${cdnStatus === 'loaded' ? 'text-emerald-400' : 'text-amber-500'}`}>
                {cdnStatus === 'loaded' ? 'CARGADO' : cdnStatus === 'loading' ? 'CARGANDO...' : 'PENDIENTE'}
              </span>
            </div>
            <div className="bg-slate-900/40 p-1.5 rounded-lg border border-slate-850 text-center">
              <span className="text-slate-500 uppercase block text-[7.5px]">Detecciones</span>
              <span className={`font-semibold ${handDetected ? 'text-emerald-400 font-bold text-[10px]' : 'text-slate-500'}`}>
                {handDetected ? 'SI' : 'NO'}
              </span>
            </div>
            <div className="bg-slate-900/40 p-1.5 rounded-lg border border-slate-850 text-center">
              <span className="text-slate-500 uppercase block text-[7.5px]">Fotogramas</span>
              <span className="font-semibold text-white">{frameCount}</span>
            </div>
            <div className="bg-slate-900/40 p-1.5 rounded-lg border border-slate-850 text-center">
              <span className="text-slate-500 uppercase block text-[7.5px]">Última Tasa</span>
              <span className="font-semibold text-cyan-400 text-[8px] truncate">{lastFrameTime || 'N/A'}</span>
            </div>
          </div>

          {/* Collapsible/Interactive Terminal Debug Console */}
          {showDiagnostics && (
            <div className="border border-slate-855 bg-black/90 rounded-2xl p-3 flex flex-col font-mono text-[9px] relative shadow-lg min-h-[140px] max-h-[160px]">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-2">
                <span className="text-slate-500 flex items-center gap-1 uppercase font-bold text-[8.5px]">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                  Terminal de Auditoría · Dual-Mano
                </span>
                
                {/* Source Selection Dials */}
                <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5" title="Repositorio de librerías WASM">
                  <button 
                    type="button"
                    onClick={() => {
                      setSourceType('cdn');
                      addLog("Modo manual: Cambiando origen a CDN oficial...");
                    }}
                    className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold cursor-pointer ${sourceType === 'cdn' ? 'bg-cyan-500/25 text-cyan-400' : 'text-slate-500'}`}
                  >
                    CDN (Estable)
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setSourceType('local');
                      addLog("Modo manual: Cambiando origen a Servidor Local...");
                    }}
                    className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold cursor-pointer ${sourceType === 'local' ? 'bg-amber-500/25 text-amber-400' : 'text-slate-500'}`}
                  >
                    Local
                  </button>
                </div>
              </div>

              {/* Logs visualizer block */}
              <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin text-slate-300 pr-1 select-text">
                {logs.length === 0 ? (
                  <span className="text-slate-600 italic">No hay logs de arranque disponibles...</span>
                ) : (
                  logs.map((log, index) => {
                    let color = "text-slate-300";
                    if (log.includes("CONCEDIDO") || log.includes("DIAGRAMA") || log.includes("¡SENSOR")) color = "text-emerald-400 font-semibold";
                    if (log.includes("ERROR") || log.includes("Fallo")) color = "text-rose-400";
                    if (log.includes("Aviso") || log.includes("FALLBACK")) color = "text-amber-400";
                    return <div key={index} className={`whitespace-pre-wrap ${color}`}>{log}</div>;
                  })
                )}
              </div>
            </div>
          )}

          {/* Callibration dials adjustments dynamically rendered */}
          {showConfig && (
            <div className="border border-slate-800 bg-slate-950/60 p-3.5 rounded-2xl space-y-3 mt-1 animate-fade-in font-mono text-[9px]">
              <span className="text-[8.5px] font-mono font-black text-amber-500 tracking-wider block uppercase">
                ⚙️ Consola de Calibración de Filtrado
              </span>

              {/* EMA alpha constant */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[8px] text-slate-400">
                  <span>CONSTANTE DE SUAVIZADO EMA (ALPHA):</span>
                  <span className="text-white font-bold">{Math.round(smoothingFactor * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.03"
                  value={smoothingFactor}
                  onChange={(e) => setSmoothingFactor(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[7px] text-slate-500 uppercase">
                  <span>Ultra amortiguado - lento</span>
                  <span>Sin filtro - con vibraciones</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-900 pt-2">
                <span className="text-slate-400">ACTIVAR ESPEJO (VÍDEO/COORDENADAS):</span>
                <button
                  type="button"
                  onClick={() => setMirrorX(!mirrorX)}
                  className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase cursor-pointer transition ${
                    mirrorX ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-500'
                  }`}
                >
                  {mirrorX ? 'SI (Por Defecto)' : 'NO'}
                </button>
              </div>

              {/* Confidence margin bar */}
              <div className="space-y-1 pt-2 border-t border-slate-900">
                <div className="flex justify-between items-center text-[8px] text-slate-400">
                  <span>MARGEN DE CONFIANZA DE RECONOCIMIENTO:</span>
                  <span className="text-white font-bold">{Math.round(detectionConfidence * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="0.85"
                  step="0.05"
                  value={detectionConfidence}
                  onChange={(e) => setDetectionConfidence(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-550"
                />
              </div>
            </div>
          )}

          {/* IMPORTANT SANDBOX AND IFRAME SAFETY ADVICE CARD */}
          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-2xl flex flex-col gap-2.5">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-200 block tracking-tight font-sans">
                  💡 ¿La cámara no se enciende en tu navegador?
                </span>
                <p className="text-[9px] text-slate-400 leading-normal select-text">
                  Las **vistas previas de entornos de desarrollo incrustados en iframes** suelen bloquear el acceso a la cámara por políticas de seguridad estrictas del navegador.
                </p>
                <p className="text-[9px] text-teal-400 leading-normal font-medium select-text">
                  Para solucionarlo, puedes abrir la aplicación **haciendo clic en el botón de abajo** para abrir el juego en una pestaña completa. Allí el navegador te solicitará el acceso de forma nativa e independiente.
                </p>
              </div>
            </div>

            {/* Arcade styling new tab launcher link */}
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-sans font-bold text-[10px] uppercase tracking-wider rounded-xl transition duration-150 cursor-pointer shadow-lg flex items-center justify-center gap-1.5 border border-cyan-400/25"
            >
              <span>Jugar en Nueva Pestaña (Arranque Seguro)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="bg-slate-950/30 border border-slate-850 p-2.5 rounded-xl text-[8.5px] text-slate-500 leading-normal flex items-start gap-1.5 font-sans">
            <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>Procesamiento Local Seguro:</strong> El streaming de video no se comparte ni se procesa fuera de tu navegador. MediaPipe se descarga una sola vez y se ejecuta íntegramente en tu GPU/CPU de forma aislada.
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
