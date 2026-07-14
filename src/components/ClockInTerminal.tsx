import { useRef, useEffect, useState } from 'react';
import { Camera, LogIn, LogOut, Loader2, ShieldCheck, AlertCircle, RefreshCw, Volume2, VolumeX, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Employee, AttendanceRecord } from '../types';

interface ClockInTerminalProps {
  onRecordAdded: () => void;
  employeesCount: number;
}

export default function ClockInTerminal({ onRecordAdded, employeesCount }: ClockInTerminalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [checkType, setCheckType] = useState<'entrada' | 'salida'>('entrada');
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [recognitionResult, setRecognitionResult] = useState<{
    success: boolean;
    recognized: boolean;
    employee?: Employee;
    record?: AttendanceRecord;
    message?: string;
    confidence?: number;
    reasoning?: string;
    rrhh?: { mensaje?: string; tarde?: boolean; minutos_tarde?: number; hora_argentina?: string };
  } | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isAutoMode, setIsAutoMode] = useState(true); // Default to true as the user wants automatic registration
  const [autoModeCooldown, setAutoModeCooldown] = useState(0);
  const [time, setTime] = useState(new Date());

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cooldown timer countdown
  useEffect(() => {
    if (autoModeCooldown <= 0) return;
    const timer = setInterval(() => {
      setAutoModeCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [autoModeCooldown]);

  // Initialize camera with progressive fallbacks (móvil / desktop / HTTPS)
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          !window.isSecureContext
            ? 'La cámara requiere HTTPS (o localhost). Abrí la URL de Vercel por https://'
            : 'Este navegador no soporta cámara.'
        );
        return;
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const attempts: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: 'user' } }, audio: false },
        { video: true, audio: false },
        { video: { facingMode: 'environment' }, audio: false },
      ];

      let mediaStream: MediaStream | null = null;
      let lastError: any = null;

      for (const constraints of attempts) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!mediaStream) {
        throw lastError || new Error('getUserMedia failed');
      }

      setStream(mediaStream);
    } catch (err: any) {
      console.error('Camera access error:', err);
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('Permiso de cámara denegado. Activá la cámara en el candado del navegador y reintentá.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('No se encontró ninguna cámara en este dispositivo.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setCameraError('La cámara está en uso por otra app. Cerrala y reintentá.');
      } else if (!window.isSecureContext) {
        setCameraError('La cámara solo funciona en HTTPS. Usá la URL de Vercel (https://…).');
      } else {
        setCameraError(`No se pudo abrir la cámara (${name || 'error'}). Revisá permisos y reintentá.`);
      }
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      // cleanup runs with latest stream via ref pattern below
    };
  }, []);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  // Attach stream when video element is ready
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    video.play().catch(() => {
      /* autoplay policies — playsInline + muted usually enough */
    });
  }, [stream]);

  // Auto scan trigger using a debounced stable capture approach
  useEffect(() => {
    if (!isAutoMode || isCapturing || autoModeCooldown > 0 || employeesCount === 0 || !stream) return;

    const timer = setTimeout(() => {
      handleRecognize();
    }, 4000); // 4 seconds of stable video before triggering auto-scan

    return () => clearTimeout(timer);
  }, [isAutoMode, isCapturing, autoModeCooldown, employeesCount, stream, checkType]);

  const speak = (text: string) => {
    if (!soundEnabled) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-MX';
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Speech synthesis error:", e);
    }
  };

  const playBeep = (success: boolean) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (success) {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.setValueAtTime(1109, ctx.currentTime); // C#6
          gain2.gain.setValueAtTime(0.1, ctx.currentTime);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.2);
        }, 120);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.error("Audio beep error:", e);
    }
  };

  const handleRecognize = async () => {
    if (!videoRef.current || isCapturing) return;

    setIsCapturing(true);
    setRecognitionResult(null);
    setStatusMessage("Capturando fotografía biométrica...");

    // Capture frame from video
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Optional: horizontal flip to match user mirror preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Restore transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const base64Image = canvas.toDataURL('image/jpeg', 0.9);

    setStatusMessage("Procesando rasgos faciales con IA Gemini...");

    try {
      const response = await fetch('/api/attendance/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo: base64Image,
          type: checkType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al procesar el reconocimiento biométrico");
      }

      setRecognitionResult(data);
      setIsCapturing(false);
      setStatusMessage(null);

      if (data.recognized && data.employee) {
        playBeep(true);
        const actionText = checkType === 'entrada' ? 'Entrada registrada' : 'Salida registrada';
        speak(`${actionText}, bienvenido ${data.employee.name}`);
        onRecordAdded();
        setAutoModeCooldown(8); // 8 seconds of cooldown to avoid registering twice
      } else {
        playBeep(false);
        speak(data.message || "No se pudo identificar el rostro.");
        setAutoModeCooldown(6); // 6 seconds cooldown before next retry
      }

    } catch (err: any) {
      console.error(err);
      setIsCapturing(false);
      setStatusMessage(null);
      setRecognitionResult({
        success: false,
        recognized: false,
        message: err.message || "Error al comunicarse con el servidor de reconocimiento."
      });
      playBeep(false);
      speak("Ocurrió un error en el sistema.");
      setAutoModeCooldown(8); // Cooldown on error too
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden flex flex-col h-full min-h-0" id="clock-terminal">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-950 text-white shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-plot/10 border border-plot/25 flex items-center justify-center shrink-0">
            <Camera className="w-4 h-4 text-plot" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-xs text-slate-100 tracking-tight truncate">Terminal</h2>
            <p className="text-[9px] text-slate-400 truncate">Escaneo facial</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg font-mono text-[11px] font-black text-white tracking-wider">
            <Clock className="w-3 h-3 text-plot animate-pulse" />
            <span>{time.toLocaleTimeString('es-MX', { hour12: false })}</span>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
            title={soundEnabled ? "Silenciar" : "Activar sonido"}
            id="btn-toggle-sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Selector de Entrada/Salida y Modo Automático */}
      <div className="px-3 py-2.5 bg-slate-950 border-b border-slate-800/80 space-y-2 shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setCheckType('entrada')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold transition duration-200 border cursor-pointer text-[11px] ${
              checkType === 'entrada'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
            id="btn-select-entrada"
          >
            <LogIn className="w-3.5 h-3.5 text-emerald-400" />
            <span>Entrada</span>
          </button>
          <button
            onClick={() => setCheckType('salida')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold transition duration-200 border cursor-pointer text-[11px] ${
              checkType === 'salida'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
            id="btn-select-salida"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Salida</span>
          </button>
        </div>

        {/* Modo Automático Toggle */}
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2.5 rounded-xl gap-2">
          <div className="min-w-0">
            <h4 className="text-[11px] font-bold text-slate-200 leading-tight">Modo automático</h4>
            <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">Registra al detectar un rostro.</p>
          </div>
          <button
            onClick={() => {
              const newVal = !isAutoMode;
              setIsAutoMode(newVal);
              if (newVal) {
                speak("Modo automático activado. Sitúese frente a la cámara.");
              } else {
                speak("Modo manual activado.");
              }
            }}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isAutoMode ? 'bg-plot' : 'bg-slate-800'
            }`}
            id="btn-toggle-auto-mode"
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isAutoMode ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Main Area: Camera View & Scan Feedback */}
      <div className="flex-1 px-3 py-2 flex flex-col items-center justify-center min-h-0 bg-slate-950 relative overflow-hidden">
        
        {/* Invisible canvas used for capturing frames */}
        <canvas ref={canvasRef} className="hidden" />

        {cameraError ? (
          <div className="w-full text-center p-4 bg-red-950/20 border border-red-900/30 rounded-2xl flex flex-col items-center gap-3">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <p className="text-xs text-red-200 font-medium leading-relaxed">{cameraError}</p>
            <button
              onClick={startCamera}
              className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800/60 border border-red-700/50 text-white font-medium py-2 px-4 rounded-xl transition duration-200 text-xs cursor-pointer"
              id="btn-retry-camera"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar</span>
            </button>
          </div>
        ) : employeesCount === 0 ? (
          <div className="w-full text-center p-4 bg-amber-950/25 border border-amber-900/40 rounded-2xl flex flex-col items-center gap-3">
            <AlertCircle className="w-10 h-10 text-amber-500 animate-pulse" />
            <div>
              <h3 className="text-amber-200 font-semibold mb-1 text-sm">Sin fotos de RRHH</h3>
              <p className="text-xs text-amber-400/90 leading-relaxed">
                Cargue fotos en los <strong>legajos</strong> de plotLAB. Este terminal solo reconoce.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative w-full aspect-[3/4] max-h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-black">
            {/* Camera Video Stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />

            {/* Scanning Laser Line Animation */}
            {isCapturing && (
              <div className="absolute inset-x-0 h-1 bg-plot shadow-[0_0_15px_#AB671B] animate-bounce top-0 bottom-0 z-10" />
            )}

            {/* Automated Scan Status Indicators */}
            {isAutoMode && (
              <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 pointer-events-none">
                <div className="bg-plot/95 backdrop-blur-md text-white font-mono text-[8px] tracking-wider uppercase font-extrabold px-2 py-1 rounded-md border border-plot/30 flex items-center gap-1.5 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Auto activo</span>
                </div>
                {autoModeCooldown > 0 ? (
                  <div className="bg-amber-600/95 backdrop-blur-md text-white font-mono text-[8px] tracking-wider uppercase font-black px-2 py-0.5 rounded-md border border-amber-500/30 shadow-md">
                    Pausa {autoModeCooldown}s
                  </div>
                ) : (
                  <div className="bg-emerald-600/95 backdrop-blur-md text-white font-mono text-[8px] tracking-wider uppercase font-black px-2 py-0.5 rounded-md border border-emerald-500/30 shadow-md animate-pulse">
                    Escaneando...
                  </div>
                )}
              </div>
            )}

            {/* Target Face Overlay Frame */}
            <div className="absolute inset-0 border-[12px] border-slate-950/70 flex items-center justify-center pointer-events-none">
              <div className="w-[70%] max-w-[220px] aspect-[3/4] border-2 border-dashed border-plot/60 rounded-[80px] relative flex items-center justify-center">
                <div className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-4 border-l-4 border-plot" />
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-4 border-r-4 border-plot" />
                <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-4 border-l-4 border-plot" />
                <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-4 border-r-4 border-plot" />
                
                <div className="text-[9px] text-plot-light font-mono tracking-widest uppercase bg-slate-950/80 px-2.5 py-0.5 rounded-full absolute -top-7 border border-plot/20">
                  {autoModeCooldown > 0 ? `Listo en ${autoModeCooldown}s` : 'Alinee su rostro'}
                </div>
              </div>
            </div>

            {/* Capture Loader Overlay */}
            <AnimatePresence>
              {statusMessage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-20"
                >
                  <Loader2 className="w-10 h-10 text-plot animate-spin mb-3" />
                  <p className="text-white font-medium text-sm mb-1">{statusMessage}</p>
                  <p className="text-[10px] text-slate-400 max-w-[200px]">
                    Analizando rasgos faciales...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Camera Capture Footer */}
      {!cameraError && employeesCount > 0 && (
        <div className="px-3 py-2.5 bg-slate-950 border-t border-slate-800 flex flex-col items-center justify-center gap-2 shrink-0">
          {isAutoMode ? (
            <div className="text-center w-full">
              <p className="text-slate-400 text-[10px] font-semibold leading-snug px-2">
                Sitúese frente al celular para registrar.
              </p>
              <button
                onClick={handleRecognize}
                disabled={isCapturing || autoModeCooldown > 0}
                className="mt-1.5 text-[10px] font-bold text-plot hover:text-plot-light bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                id="btn-force-scan"
              >
                {autoModeCooldown > 0 ? `Espera ${autoModeCooldown}s` : 'Forzar escaneo'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleRecognize}
              disabled={isCapturing}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold shadow-md cursor-pointer transition transform active:scale-[0.98] text-xs ${
                checkType === 'entrada'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
              id="btn-trigger-recognition"
            >
              <Camera className="w-4 h-4" />
              <span>Registrar {checkType === 'entrada' ? 'Entrada' : 'Salida'}</span>
            </button>
          )}
        </div>
      )}

      {/* Result Presentation Block */}
      <AnimatePresence>
        {recognitionResult && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="px-3 py-2.5 border-t border-slate-800 bg-slate-950 shrink-0 max-h-[28%] overflow-y-auto"
          >
            {recognitionResult.recognized ? (
              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3 flex gap-3 items-start">
                <div className="relative shrink-0">
                  <img
                    src={recognitionResult.employee?.photo}
                    alt={recognitionResult.employee?.name}
                    className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-500/50"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-emerald-600 border-2 border-slate-900 rounded-full p-0.5 text-white">
                    <ShieldCheck className="w-3 h-3" />
                  </div>
                </div>
                
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-md uppercase border border-emerald-500/20">
                      {checkType === 'entrada' ? 'Entrada OK' : 'Salida OK'}
                    </span>
                    <span className="text-emerald-400 font-mono text-[10px] font-bold">
                      {recognitionResult.confidence}%
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-sm mt-0.5 tracking-tight truncate">
                    {recognitionResult.employee?.name}
                  </h3>
                  <p className="text-slate-400 text-[10px] font-medium truncate">
                    {recognitionResult.employee?.role} • {recognitionResult.employee?.id}
                  </p>
                  {(recognitionResult.message || recognitionResult.rrhh?.mensaje) && (
                    <p className="text-emerald-300/90 text-[10px] mt-1 leading-snug">
                      {recognitionResult.message || recognitionResult.rrhh?.mensaje}
                    </p>
                  )}
                  {recognitionResult.rrhh?.tarde && (
                    <p className="text-amber-400 text-[9px] font-bold mt-0.5">
                      Tardanza: {recognitionResult.rrhh.minutos_tarde} min
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-3 flex gap-3 items-start">
                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl shrink-0 border border-rose-500/10">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <span className="bg-rose-500/10 text-rose-400 text-[9px] font-black px-2 py-0.5 rounded-md uppercase border border-rose-500/20">
                    No reconocido
                  </span>
                  <h3 className="font-bold text-white text-sm mt-0.5 tracking-tight">
                    Acceso no registrado
                  </h3>
                  <p className="text-[10px] text-slate-300 mt-0.5 line-clamp-2">
                    {recognitionResult.message}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
