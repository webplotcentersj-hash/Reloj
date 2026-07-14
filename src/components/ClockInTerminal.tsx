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

  // Initialize camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError("No se pudo acceder a la cámara. Asegúrese de otorgar los permisos necesarios.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden flex flex-col h-full" id="clock-terminal">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center">
            <span className="text-lg">⏱️</span>
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-100 tracking-tight">Terminal de Asistencia</h2>
            <p className="text-[10px] text-slate-400">Escaneo facial integrado en tiempo real</p>
          </div>
        </div>

        {/* Large digital ticking clock directly inside the terminal header */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl font-mono text-sm font-black text-white shadow-inner tracking-wider">
          <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
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

      {/* Selector de Entrada/Salida y Modo Automático */}
      <div className="p-4 bg-slate-950 border-b border-slate-800/80 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setCheckType('entrada')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition duration-200 border cursor-pointer text-xs ${
              checkType === 'entrada'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
            id="btn-select-entrada"
          >
            <LogIn className="w-4 h-4 text-emerald-400" />
            <span>Registrar Entrada</span>
          </button>
          <button
            onClick={() => setCheckType('salida')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition duration-200 border cursor-pointer text-xs ${
              checkType === 'salida'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
            id="btn-select-salida"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Registrar Salida</span>
          </button>
        </div>

        {/* Modo Automático Toggle */}
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-xl">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🤖</span>
            <div>
              <h4 className="text-xs font-bold text-slate-200 leading-tight">Modo Manos Libres (Automático)</h4>
              <p className="text-[9px] text-slate-400 mt-0.5">El sistema tomará fotos y registrará asistencia automáticamente al detectar un rostro.</p>
            </div>
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
              isAutoMode ? 'bg-indigo-600' : 'bg-slate-800'
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
      <div className="flex-1 p-4 md:p-6 flex flex-col items-center justify-center min-h-[360px] bg-slate-950 relative overflow-hidden">
        
        {/* Invisible canvas used for capturing frames */}
        <canvas ref={canvasRef} className="hidden" />

        {cameraError ? (
          <div className="max-w-md text-center p-6 bg-red-950/20 border border-red-900/30 rounded-2xl flex flex-col items-center gap-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <p className="text-sm text-red-200 font-medium leading-relaxed">{cameraError}</p>
            <button
              onClick={startCamera}
              className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800/60 border border-red-700/50 text-white font-medium py-2 px-5 rounded-xl transition duration-200 text-sm cursor-pointer"
              id="btn-retry-camera"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reintentar Conexión</span>
            </button>
          </div>
        ) : employeesCount === 0 ? (
          <div className="max-w-md text-center p-8 bg-amber-950/25 border border-amber-900/40 rounded-2xl flex flex-col items-center gap-4">
            <AlertCircle className="w-12 h-12 text-amber-500 animate-pulse" />
            <div>
              <h3 className="text-amber-200 font-semibold mb-1 text-base">Falta base de datos biométrica</h3>
              <p className="text-sm text-amber-400/90 leading-relaxed">
                Aún no hay ningún empleado registrado. Abra el panel de <strong>Configurar</strong> para registrar rostros y de paso enlazar el webhook de su sistema de Recursos Humanos externo.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative w-full max-w-lg aspect-[4/3] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-black">
            {/* Camera Video Stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />

            {/* Floating digital clock inside camera */}
            <div className="absolute top-4 right-4 bg-slate-950/90 border border-indigo-500/30 px-3 py-1 rounded-xl shadow-lg flex items-center gap-1.5 font-mono text-xs font-black text-white z-10">
              <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>{time.toLocaleTimeString('es-MX', { hour12: false })}</span>
            </div>

            {/* Scanning Laser Line Animation */}
            {isCapturing && (
              <div className="absolute inset-x-0 h-1 bg-indigo-500 shadow-[0_0_15px_#6366f1] animate-bounce top-0 bottom-0 z-10" />
            )}

            {/* Automated Scan Status Indicators */}
            {isAutoMode && (
              <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 pointer-events-none">
                <div className="bg-indigo-600/95 backdrop-blur-md text-white font-mono text-[9px] tracking-wider uppercase font-extrabold px-2.5 py-1 rounded-md border border-indigo-500/30 flex items-center gap-1.5 shadow-md">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Auto-Checador Activo</span>
                </div>
                {autoModeCooldown > 0 ? (
                  <div className="bg-amber-600/95 backdrop-blur-md text-white font-mono text-[8px] tracking-wider uppercase font-black px-2 py-0.5 rounded-md border border-amber-500/30 shadow-md">
                    Pausa: Esperando {autoModeCooldown}s
                  </div>
                ) : (
                  <div className="bg-emerald-600/95 backdrop-blur-md text-white font-mono text-[8px] tracking-wider uppercase font-black px-2 py-0.5 rounded-md border border-emerald-500/30 shadow-md animate-pulse">
                    Escaneando en breve...
                  </div>
                )}
              </div>
            )}

            {/* Target Face Overlay Frame */}
            <div className="absolute inset-0 border-[16px] border-slate-950/70 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-72 border-2 border-dashed border-indigo-400/60 rounded-[100px] relative flex items-center justify-center">
                {/* Corner Accents */}
                <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-indigo-400" />
                <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-indigo-400" />
                <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-indigo-400" />
                <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-indigo-400" />
                
                {/* Overlay guides */}
                <div className="text-[10px] text-indigo-300 font-mono tracking-widest uppercase bg-slate-950/80 px-3 py-1 rounded-full absolute -top-8 border border-indigo-500/20">
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
                  className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20"
                >
                  <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
                  <p className="text-white font-medium text-base mb-2">{statusMessage}</p>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Gemini está analizando la fisonomía de la captura contra nuestra base de referencia.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Camera Capture Footer */}
      {!cameraError && employeesCount > 0 && (
        <div className="p-5 bg-slate-950 border-t border-slate-800 flex flex-col items-center justify-center gap-3">
          {isAutoMode ? (
            <div className="text-center">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                <span className="w-2 rounded-full bg-indigo-500 animate-pulse" />
                <span>Sitúese frente a la pantalla para registrar asistencia sin tocar la tablet.</span>
              </div>
              <button
                onClick={handleRecognize}
                disabled={isCapturing || autoModeCooldown > 0}
                className="mt-2 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-slate-900 border border-slate-800 hover:border-slate-700 px-4 py-1.5 rounded-lg shadow-2xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                id="btn-force-scan"
              >
                {autoModeCooldown > 0 ? `Reanudando auto-escaneo en ${autoModeCooldown}s` : 'Forzar Escaneo Manual'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleRecognize}
              disabled={isCapturing}
              className={`flex items-center gap-3 px-8 py-4 rounded-xl text-white font-semibold shadow-md cursor-pointer hover:shadow-lg transition transform active:scale-95 duration-150 text-sm ${
                checkType === 'entrada'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
              }`}
              id="btn-trigger-recognition"
            >
              <Camera className="w-4 h-4" />
              <span>Registrar {checkType === 'entrada' ? 'Entrada' : 'Salida'} Biométrica</span>
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
            className="p-5 border-t border-slate-800 bg-slate-950"
          >
            {recognitionResult.recognized ? (
              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start">
                <div className="relative flex-shrink-0">
                  <img
                    src={recognitionResult.employee?.photo}
                    alt={recognitionResult.employee?.name}
                    className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-500/50"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-emerald-600 border-2 border-slate-900 rounded-full p-0.5 text-white">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                </div>
                
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-md uppercase border border-emerald-500/20">
                      {checkType === 'entrada' ? 'Entrada Autorizada' : 'Salida Autorizada'}
                    </span>
                    <span className="text-emerald-400 font-mono text-xs font-bold">
                      Similitud: {recognitionResult.confidence}%
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-base mt-1 tracking-tight">
                    {recognitionResult.employee?.name}
                  </h3>
                  <p className="text-slate-400 text-xs font-medium">
                    {recognitionResult.employee?.role} • ID: {recognitionResult.employee?.id}
                  </p>
                  
                  <div className="mt-2 text-xs text-slate-300 bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-900/20">
                    <strong className="text-emerald-400 font-bold">Dictamen de IA: </strong>
                    {recognitionResult.reasoning}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start">
                <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl flex-shrink-0 border border-rose-500/10">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div className="flex-1 text-left">
                  <span className="bg-rose-500/10 text-rose-400 text-[10px] font-black px-2.5 py-1 rounded-md uppercase border border-rose-500/20">
                    Error de Reconocimiento
                  </span>
                  <h3 className="font-bold text-white text-base mt-1 tracking-tight">
                    Acceso No Registrado
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    {recognitionResult.message}
                  </p>
                  
                  {recognitionResult.reasoning && (
                    <div className="mt-2 text-xs text-slate-300 bg-rose-950/30 p-2.5 rounded-lg border border-rose-900/20">
                      <strong className="text-rose-400 font-bold">Análisis: </strong>
                      {recognitionResult.reasoning}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
}
