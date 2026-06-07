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
  Video
} from 'lucide-react';

const mediaPipePrintErr = (msg: any, ...args: any[]) => {
  const fullMsg = typeof msg === 'string' ? msg : String(msg);
  
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
  onCoordsTracked: (x: number, y: number, isEngaged: boolean) => void;
  canvasWidth: number;
  canvasHeight: number;
  isEnabled: boolean;
  onStatusChange?: (status: 'inactive' | 'loading' | 'active' | 'error', errorMsg?: string) => void;
  onFallbackToMouse?: () => void;
}

export default function HandTracker({
  onCoordsTracked,
  canvasWidth,
  canvasHeight,
  isEnabled,
  onStatusChange,
  onFallbackToMouse
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

  // Stats Counters
  const [frameCount, setFrameCount] = useState(0);
  const [lastFrameTime, setLastFrameTime] = useState<string>('');
  
  // Advanced Calibration
  const [smoothingFactor, setSmoothingFactor] = useState(0.24);
  const [mirrorX, setMirrorX] = useState(true);
  const [detectionConfidence, setDetectionConfidence] = useState(0.60);

  // Camera Devices Listing
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handsInstanceRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIdRef = useRef<number | null>(null);

  // EMA Coordinates Storage
  const lastXRef = useRef<number | null>(null);
  const lastYRef = useRef<number | null>(null);

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

    addLog(`Detección Óptica Activada. Iniciando flujo en modo: ${sourceType.toUpperCase()}`);
    setCdnStatus('loading');
    if (onStatusChange) onStatusChange('loading');

    const injectScripts = async () => {
      try {
        if (sourceType === 'local') {
          addLog("Intentando cargar libs locales desde '/mediapipe/'...");
          await loadScript('/mediapipe/camera_utils.js');
          await loadScript('/mediapipe/hands.js');
        } else {
          addLog("Intentando cargar libs estables desde Google CDN (jsdelivr)...");
          await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js');
          await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js');
        }
        
        addLog("Scripts cargados con éxito. Instanciando pipeline de detección...");
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
          modelComplexity: 1,
          minDetectionConfidence: detectionConfidence,
          minTrackingConfidence: 0.50,
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
      }

      addLog("Creando nueva instancia de MediaPipe Hands...");
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
        modelComplexity: 1,
        minDetectionConfidence: detectionConfidence,
        minTrackingConfidence: 0.50,
      });

      hands.onResults(handleResults);
      handsInstanceRef.current = hands;
      addLog("Instancia Hands vinculada con éxito.");

      // Check for video element
      if (!videoRef.current) {
        throw new Error("El nodo reproductor de Video no está asignado en el DOM.");
      }

      // Build constraints
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
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
      if (!videoRef.current || !isEnabled) {
        addLog("Detección suspendida post-aprobación del usuario.");
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      try {
        await videoRef.current.play();
        addLog(`Reproductor de video activo. Resolucion actual: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
      } catch (pErr) {
        addLog(`Aviso de reproducción: Asegura permisos de autoplay/silencio (${pErr})`);
      }

      // Launch custom optimized tracking loop (RequestAnimationFrame)
      let isProcessing = false;
      addLog("Iniciando bucle de escaneo de FPS...");

      const tick = async () => {
        if (!isEnabled || !handsInstanceRef.current || !videoRef.current) {
          return;
        }

        if (videoRef.current.paused || videoRef.current.ended) {
          frameIdRef.current = requestAnimationFrame(tick);
          return;
        }

        // ReadyState >= 2 indicates HAVE_CURRENT_DATA or higher
        if (videoRef.current.readyState >= 2 && !isProcessing) {
          isProcessing = true;
          try {
            await handsInstanceRef.current.send({ image: videoRef.current });
          } catch (sendErr) {
            // Prevent spamming logs on every skipped frame
            console.warn("MediaPipe tick sync skip:", sendErr);
          } finally {
            isProcessing = false;
          }
        }

        if (isEnabled) {
          frameIdRef.current = requestAnimationFrame(tick);
        }
      };

      frameIdRef.current = requestAnimationFrame(tick);
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

    lastXRef.current = null;
    lastYRef.current = null;
    addLog("Sensor apagado.");
  };

  // Process Landmarks
  const handleResults = (results: any) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      if (handDetected) {
        addLog("Mano fuera del área de escaneo.");
        setHandDetected(false);
      }
      return;
    }

    if (!handDetected) {
      addLog("¡MANO ENCONTRADA! Iniciando rastreo...");
      setHandDetected(true);
    }

    // Stats updates
    setFrameCount(f => f + 1);
    setLastFrameTime(new Date().toLocaleTimeString());

    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[8]; // INDEX_FINGER_TIP

    let normX = indexTip.x;
    if (mirrorX) {
      normX = 1 - normX;
    }
    const normY = indexTip.y;

    // Convert coordinates
    const targetX = normX * canvasWidth;
    const targetY = normY * canvasHeight;

    let finalX = targetX;
    let finalY = targetY;

    // Exponential Moving Average (EMA)
    if (lastXRef.current !== null && lastYRef.current !== null) {
      finalX = smoothingFactor * targetX + (1 - smoothingFactor) * lastXRef.current;
      finalY = smoothingFactor * targetY + (1 - smoothingFactor) * lastYRef.current;
    }

    lastXRef.current = finalX;
    lastYRef.current = finalY;

    // Dispatch translated slice signals to canvas game
    onCoordsTracked(finalX, finalY, true);

    // Draw cyber-skeleton feedback
    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;

    const connect = (indices: number[]) => {
      ctx.beginPath();
      indices.forEach((idx, i) => {
        const pt = landmarks[idx];
        const cx = (mirrorX ? 1 - pt.x : pt.x) * canvas.width;
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
      const cx = (mirrorX ? 1 - pt.x : pt.x) * canvas.width;
      const cy = pt.y * canvas.height;
      ctx.beginPath();
      ctx.arc(cx, cy, idx === 8 ? 6 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = idx === 8 ? '#f43f5e' : '#10b981'; // Red tip, green joints
      ctx.fill();
    });
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
    <div id="optical-tracker-panel" className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Laser header border */}
      <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent animate-pulse" />

      {/* Main HUD Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800/80 pb-4 mb-4 gap-3">
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
              Consola de Calibración Óptica
              {modelStatus === 'active' && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">SELECCIÓN Y AUDITORÍA DE HARDWARE EN VIVO</p>
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

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* COL 1: Webcam Video Preview Block (width is 5 columns) */}
        <div className="md:col-span-5 flex flex-col items-center justify-start relative space-y-3">
          <div className="relative w-full aspect-[4/3] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
            
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

            {/* Black-screen HUDs depending on status */}
            {modelStatus === 'off' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-20 bg-slate-950/90 backdrop-blur-sm">
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
                  Inicializando Pipeline
                </span>
                <p className="text-[9px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">
                  Cargando librerías WebAssembly y abriendo sensor local...
                </p>
              </div>
            )}

            {modelStatus === 'active' && !handDetected && (
              <div className="absolute inset-x-0 bottom-4 mx-auto w-fit bg-slate-950/90 border border-amber-500/30 text-[9px] font-mono text-amber-400 px-3 py-1 rounded-full z-20 flex items-center justify-center gap-1.5 animate-pulse shadow-md">
                <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-ping"></span>
                <span>MUESTRA TU MANO FRENTE A LA PANTALLA</span>
              </div>
            )}

            {modelStatus === 'active' && handDetected && (
              <div className="absolute top-4 left-4 bg-emerald-950/90 border border-emerald-500/40 text-[9px] font-mono text-emerald-400 px-2.5 py-1 rounded-lg z-20 flex items-center gap-1.5 font-bold shadow-md">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>DIAGRAMA ACTIVO</span>
              </div>
            )}

            {modelStatus === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-20 bg-rose-950/95 backdrop-blur-sm">
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

          {/* Quick Info Box */}
          <div className="w-full bg-slate-950/50 border border-slate-850 p-3 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Dispositivo de Entrada:</span>
              <Video className="w-3.5 h-3.5 text-slate-500" />
            </div>
            
            <select
              value={selectedDeviceId}
              onChange={handleCameraChange}
              className="w-full text-[10px] bg-slate-950 border border-slate-800 text-slate-300 rounded-lg py-1.5 px-2 outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/20 font-mono"
            >
              <option value="">-- Cámara Predeterminada --</option>
              {devices.map((device, index) => (
                <option key={device.deviceId || index} value={device.deviceId}>
                  {device.label || `Cámara Secundaria (${index + 1})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* COL 2: Real-time Debug Logs Terminal and Calibration Dials (width is 7 columns) */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-4">
          
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
                  Terminal de Auditoría MediaPipe / WebSocket
                </span>
                
                {/* Source Selection Dials */}
                <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5" title="Repositorio de librerías WASM">
                  <button 
                    type="button"
                    onClick={() => {
                      setSourceType('cdn');
                      addLog("Modo manual: Cambiando origen a CDN oficial...");
                    }}
                    className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold ${sourceType === 'cdn' ? 'bg-cyan-500/25 text-cyan-400' : 'text-slate-500'}`}
                  >
                    CDN (Estable)
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setSourceType('local');
                      addLog("Modo manual: Cambiando origen a Servidor Local...");
                    }}
                    className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold ${sourceType === 'local' ? 'bg-amber-500/25 text-amber-400' : 'text-slate-500'}`}
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
              className="w-full py-2 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-sans font-bold text-[10px] uppercase tracking-wider rounded-xl transition duration-150 active:scale-[0.98] cursor-pointer shadow-lg flex items-center justify-center gap-1.5 border border-cyan-400/25"
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

      </div>
    </div>
  );
}
