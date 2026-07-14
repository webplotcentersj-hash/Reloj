import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  ArrowLeft,
  RefreshCw,
  ImagePlus,
} from 'lucide-react';
import { Employee } from '../types';

interface PhotoUploadPanelProps {
  onBack: () => void;
  onSaved: () => void;
}

const REQUIREMENTS = [
  'Rostro de frente, mirando a la cámara',
  'Buena iluminación (evitar contraluz)',
  'Sin gorra, bufanda ni lentes oscuros',
  'Una sola persona, nítida y centrada',
  'JPG o PNG, preferible hasta 2–4 MB',
];

export default function PhotoUploadPanel({ onBack, onSaved }: PhotoUploadPanelProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [camStream, setCamStream] = useState<MediaStream | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/employees?all=1&refresh=1&light=1');
      const raw = await res.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Respuesta inválida del servidor (${res.status})`);
      }
      if (!res.ok) {
        throw new Error(data?.error || data?.details || `Error ${res.status}`);
      }
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setLoadError(err.message || 'No se pudieron cargar empleados');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (!cameraOn || !camStream || !videoRef.current) return;
    videoRef.current.srcObject = camStream;
    videoRef.current.play().catch(() => {});
  }, [cameraOn, camStream]);

  const stopCamera = () => {
    camStream?.getTracks().forEach((t) => t.stop());
    setCamStream(null);
    setCameraOn(false);
  };

  const startCamera = async () => {
    setError(null);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      setCamStream(stream);
      setCameraOn(true);
    } catch {
      setError('No se pudo abrir la cámara. Usá «Subir archivo».');
    }
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setPreview(dataUrl);
    stopCamera();
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen (JPG/PNG).');
      return;
    }
    if (file.size > 6_000_000) {
      setError('Máximo 6 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const selected = employees.find((e) => e.id === selectedId) || null;

  const savePhoto = async () => {
    if (!selected || !preview) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/employees/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idUsuario: selected.id, photo: preview }),
      });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(`Error de servidor (${res.status})`);
      }
      if (!res.ok) {
        throw new Error(data.error || data.details || 'No se pudo guardar');
      }
      setMessage(data.message || 'Foto guardada');
      setPreview(null);
      setSelectedId(null);
      await load();
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const withoutPhoto = employees.filter((e) => !e.tieneFoto || !e.photo);
  const withPhoto = employees.filter((e) => e.tieneFoto && e.photo);

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden" id="photo-upload-panel">
      <div className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-2 shrink-0 bg-slate-950">
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onBack();
          }}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
          id="btn-photos-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-black text-white truncate">Fotos de legajo</h2>
          <p className="text-[9px] text-slate-500">RRHH · reconocimiento facial</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          title="Actualizar"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        <div className="p-3 rounded-2xl bg-plot/10 border border-plot/25 space-y-2">
          <p className="text-[11px] font-bold text-plot">Requisitos de la foto</p>
          <ul className="space-y-1">
            {REQUIREMENTS.map((r) => (
              <li key={r} className="text-[10px] text-plot-light leading-snug flex gap-1.5">
                <span className="text-plot shrink-0">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {message && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] flex gap-2 items-center">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            {message}
          </div>
        )}
        {error && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-[11px] flex gap-2 items-start">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {loadError && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px]">
            {loadError}
            <p className="mt-1 text-[10px] text-amber-500/90">
              Verificá SUPABASE_ANON_KEY en Vercel y Redeploy.
            </p>
          </div>
        )}

        {loading ? (
          <div className="py-10 flex justify-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : selected ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setPreview(null);
                stopCamera();
                setError(null);
              }}
              className="text-[10px] font-bold text-plot cursor-pointer"
            >
              ← Volver al listado
            </button>
            <div className="flex items-center gap-2">
              {selected.photo ? (
                <img src={selected.photo} alt="" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{selected.name}</p>
                <p className="text-[9px] text-slate-500 font-mono">ID {selected.id}</p>
              </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {cameraOn ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-700 aspect-[3/4] bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute inset-x-0 bottom-0 p-2 flex gap-2 bg-slate-950/80">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="flex-1 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={captureFromCamera}
                    className="flex-1 py-2 rounded-xl bg-plot text-xs font-bold text-white cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" /> Capturar
                  </button>
                </div>
              </div>
            ) : preview ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-700 aspect-[3/4] bg-slate-950">
                <img src={preview} alt="Vista previa" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-rose-600 text-[10px] font-bold text-white cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex-1 py-3 rounded-xl bg-plot text-xs font-bold text-white cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" /> Cámara
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 py-3 rounded-xl border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" /> Archivo
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] || null)}
                />
              </div>
            )}

            {preview && (
              <button
                type="button"
                disabled={saving}
                onClick={savePhoto}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                id="btn-save-legajo-photo"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…
                  </>
                ) : (
                  <>
                    <ImagePlus className="w-3.5 h-3.5" /> Guardar en RRHH
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {withoutPhoto.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1.5">
                  Sin foto ({withoutPhoto.length})
                </p>
                <div className="space-y-1.5">
                  {withoutPhoto.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(emp.id);
                        setPreview(null);
                        setMessage(null);
                        setError(null);
                      }}
                      className="w-full p-2.5 rounded-xl border border-amber-500/20 bg-slate-950 flex items-center gap-2 text-left cursor-pointer hover:border-plot/40"
                    >
                      <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-white truncate">{emp.name}</p>
                        <p className="text-[9px] text-slate-500">{emp.role}</p>
                      </div>
                      <span className="text-[9px] font-bold text-plot">Subir</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {withPhoto.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1.5">
                  Con foto ({withPhoto.length})
                </p>
                <div className="space-y-1.5">
                  {withPhoto.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(emp.id);
                        setPreview(null);
                        setMessage(null);
                        setError(null);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-800 bg-slate-950 flex items-center gap-2 text-left cursor-pointer hover:border-plot/40"
                    >
                      <img
                        src={emp.photo}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-white truncate">{emp.name}</p>
                        <p className="text-[9px] text-slate-500">{emp.role}</p>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">Cambiar</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!withoutPhoto.length && !withPhoto.length && !loadError && (
              <p className="text-center text-xs text-slate-500 py-8">No hay empleados en RRHH.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
