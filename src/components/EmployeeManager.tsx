import React, { useRef, useState, useEffect } from 'react';
import { Plus, Trash2, Camera, Upload, AlertCircle, Loader2, CheckCircle2, User, HelpCircle, FileImage } from 'lucide-react';
import { Employee } from '../types';

interface EmployeeManagerProps {
  employees: Employee[];
  onEmployeeAdded: () => void;
  onEmployeeDeleted: () => void;
}

export default function EmployeeManager({ employees, onEmployeeAdded, onEmployeeDeleted }: EmployeeManagerProps) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // For capturing photo inside form
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // For drag and drop upload
  const [isDragging, setIsDragging] = useState(false);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 400, height: 300 },
        audio: false
      });
      setStream(mediaStream);
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("No se pudo iniciar la cámara. Asegúrese de dar permisos.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 400;
      canvas.height = video.videoHeight || 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError("El archivo seleccionado debe ser una imagen.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setPhoto(e.target.result as string);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!id.trim() || !name.trim() || !role.trim()) {
      setError("Por favor complete todos los campos de texto.");
      return;
    }

    if (!photo) {
      setError("Por favor capture o suba una foto de referencia biométrica.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: id.trim().toUpperCase(),
          name: name.trim(),
          role: role.trim(),
          photo
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocurrió un error al registrar el empleado.");
      }

      setSuccess(true);
      setId('');
      setName('');
      setRole('');
      setPhoto(null);
      onEmployeeAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (employeeId: string, employeeName: string) => {
    if (!confirm(`¿Está seguro de que desea eliminar a ${employeeName} de la base biométrica?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al eliminar el empleado");
      }

      onEmployeeDeleted();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="employee-manager">
      
      {/* Form: Register New Employee */}
      <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm h-fit">
        <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <Plus className="w-5 h-5 text-indigo-600" />
          <span>Registrar Empleado</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Status Feedback */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-700 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2 text-emerald-800 text-xs leading-relaxed">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Empleado registrado exitosamente en la base de datos biométrica.</span>
            </div>
          )}

          {/* Form fields */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Código / ID de Empleado
            </label>
            <input
              type="text"
              placeholder="Ej. EMP-105"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-slate-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition text-sm font-medium"
              required
              disabled={isSaving}
              id="input-employee-id"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Nombre Completo
            </label>
            <input
              type="text"
              placeholder="Ej. Juan Carlos Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-slate-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition text-sm font-medium"
              required
              disabled={isSaving}
              id="input-employee-name"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Cargo / Departamento
            </label>
            <input
              type="text"
              placeholder="Ej. Gerente de Logística"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-slate-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition text-sm font-medium"
              required
              disabled={isSaving}
              id="input-employee-role"
            />
          </div>

          {/* Biometric Reference Photo Option */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Foto de Referencia Facial
            </label>
            
            {cameraActive ? (
              <div className="relative rounded-xl overflow-hidden bg-black border border-gray-200 aspect-[4/3] flex flex-col justify-between">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {cameraError && (
                  <p className="absolute inset-x-0 bottom-12 bg-red-950/85 p-2 text-center text-white text-xs">{cameraError}</p>
                )}

                <div className="absolute inset-x-0 bottom-0 p-3 bg-slate-950/80 backdrop-blur-sm flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium cursor-pointer"
                    id="btn-cancel-cam"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    id="btn-snap-photo"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Tomar Foto</span>
                  </button>
                </div>
              </div>
            ) : photo ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-100 aspect-[4/3] bg-slate-50 flex items-center justify-center">
                <img src={photo} alt="Vista previa de referencia" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-red-600/95 hover:bg-red-700 text-white shadow-md transition cursor-pointer"
                  title="Eliminar foto"
                  id="btn-delete-uploaded-photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 bg-emerald-600/90 backdrop-blur-sm text-white text-[10px] py-1 px-2.5 rounded-md font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition flex flex-col items-center justify-center min-h-[160px] cursor-pointer ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/45'
                    : 'border-gray-200 hover:border-indigo-400 hover:bg-slate-50/50'
                }`}
              >
                <FileImage className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-xs text-slate-500 font-medium mb-1">
                  Arrastre una imagen aquí o
                </p>
                <div className="flex gap-2 mt-2">
                  <label className="bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 text-xs font-semibold py-1.5 px-3 rounded-lg cursor-pointer transition shadow-xs flex items-center gap-1">
                    <Upload className="w-3 h-3 text-slate-500" />
                    <span>Subir archivo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
                    id="btn-start-camera-capture"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Usar Cámara</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition duration-150 text-sm shadow-md cursor-pointer disabled:bg-indigo-400 disabled:cursor-not-allowed"
            id="btn-submit-employee"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando Biometría...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Registrar en Base Biométrica</span>
              </>
            )}
          </button>

        </form>
      </div>

      {/* Grid: Registered Employees Database */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              <span>Base Biométrica Activa</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Listado de personal verificado para coincidencia facial</p>
          </div>
          <span className="bg-slate-100 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full">
            {employees.length} {employees.length === 1 ? 'Empleado' : 'Empleados'}
          </span>
        </div>

        {employees.length === 0 ? (
          <div className="flex-1 border border-dashed border-gray-100 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-50/50 min-h-[300px]">
            <HelpCircle className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-800 font-semibold text-sm mb-1">Sin personal registrado</p>
            <p className="text-xs text-slate-400 max-w-sm">
              Registre empleados utilizando el formulario lateral. Asegúrese de capturar una foto frontal nítida de su rostro para un reconocimiento correcto.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto max-h-[600px] pr-1">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="p-4 border border-gray-100 rounded-xl hover:border-slate-200 hover:shadow-xs transition duration-200 flex items-start gap-3 bg-white"
              >
                <img
                  src={emp.photo}
                  alt={emp.name}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-100 flex-shrink-0 bg-slate-100 shadow-inner"
                />
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900 text-sm truncate leading-tight tracking-tight">
                    {emp.name}
                  </h4>
                  <p className="text-xs text-slate-500 truncate mt-0.5 font-medium">{emp.role}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-1 font-semibold">ID: {emp.id}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    Registrado: {new Date(emp.createdAt).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>

                <button
                  onClick={() => handleDelete(emp.id, emp.name)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0 cursor-pointer"
                  title="Eliminar empleado"
                  id={`btn-delete-emp-${emp.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
