import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileSpreadsheet, 
  Fingerprint, 
  Settings, 
  Lock, 
  Wifi, 
  Battery, 
  Signal, 
  Server, 
  RefreshCw, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  HelpCircle,
  Info,
  Eye,
  X
} from 'lucide-react';
import ClockInTerminal from './components/ClockInTerminal';
import EmployeeManager from './components/EmployeeManager';
import { Employee, AttendanceRecord, TerminalSettings } from './types';

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<TerminalSettings>({
    deviceName: 'plotLAB Reloj Facial 1',
    deviceId: 'plotlab-reloj-facial-1',
    supabaseConfigured: false,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  
  const [settingsTab, setSettingsTab] = useState<'api' | 'employees' | 'records'>('api');
  
  const [deviceNameInput, setDeviceNameInput] = useState('');
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState('');
  const [isRefreshingEmployees, setIsRefreshingEmployees] = useState(false);

  const [selectedAuditRecord, setSelectedAuditRecord] = useState<AttendanceRecord | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchEmployees = async (opts?: { all?: boolean; refresh?: boolean }) => {
    try {
      const params = new URLSearchParams();
      if (opts?.all) params.set('all', '1');
      if (opts?.refresh) params.set('refresh', '1');
      const qs = params.toString() ? `?${params}` : '';
      const response = await fetch(`/api/employees${qs}`);
      if (response.ok) {
        const data = await response.json();
        if (opts?.all) {
          setAllEmployees(data);
          setEmployees(data.filter((e: Employee) => e.tieneFoto !== false && e.photo));
        } else {
          setEmployees(data);
        }
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/attendance');
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (err) {
      console.error("Error fetching attendance records:", err);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setDeviceNameInput(data.deviceName || 'plotLAB Reloj Facial 1');
        setDeviceIdInput(data.deviceId || 'plotlab-reloj-facial-1');
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchEmployees(),
      fetchRecords(),
      fetchSettings(),
    ]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenSettingsClick = () => {
    setPasscode('');
    setPasscodeError('');
    setIsPasscodeModalOpen(true);
  };

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === '1234') {
      setIsPasscodeModalOpen(false);
      setIsSettingsOpen(true);
      fetchEmployees({ all: true, refresh: true });
    } else {
      setPasscodeError('Código incorrecto. Pruebe con "1234"');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSaveSuccess(false);
    setSettingsSaveError('');

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: deviceNameInput.trim() || 'plotLAB Reloj Facial 1',
          deviceId: (deviceIdInput.trim() || 'plotlab-reloj-facial-1').toLowerCase(),
        })
      });

      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        setSettingsSaveError(
          response.ok
            ? 'Respuesta inválida del servidor'
            : `Error del servidor (${response.status}). Revisá Environment Variables en Vercel y Redeploy.`
        );
        return;
      }

      if (response.ok) {
        setSettings(data.settings);
        setDeviceIdInput(data.settings?.deviceId || deviceIdInput);
        setSettingsSaveSuccess(true);
        fetchSettings();
      } else {
        setSettingsSaveError(data?.error || data?.details || 'Error al guardar');
      }
    } catch (err: any) {
      setSettingsSaveError(err.message || 'Error de red');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleRefreshEmployees = async () => {
    setIsRefreshingEmployees(true);
    await fetchEmployees({ all: true, refresh: true });
    setIsRefreshingEmployees(false);
  };

  const handleForceResync = async (_record: AttendanceRecord) => {
    alert('Las marcaciones ya se guardan directo en plotLAB RRHH.');
  };

  return (
    <div className="min-h-dvh bg-[#0c0a08] flex items-center justify-center p-3 sm:p-6 font-sans selection:bg-plot/10 selection:text-plot" id="app-root">
      
      {/* Marco celular (portrait) */}
      <div className="w-full max-w-[390px] h-[min(844px,100dvh)] sm:h-[min(844px,calc(100dvh-3rem))] bg-slate-900 rounded-[28px] sm:rounded-[36px] border-[5px] sm:border-8 border-slate-800 shadow-2xl overflow-hidden flex flex-col relative">
        
        {/* Notch / Dynamic Island hint */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 w-24 h-6 bg-slate-950 rounded-full pointer-events-none hidden sm:block" aria-hidden />

        {/* Android Status Bar */}
        <div className="bg-slate-950 text-slate-400 px-4 pt-2 pb-1.5 flex justify-between items-center text-[10px] select-none shrink-0 relative z-20">
          <div className="flex items-center gap-1.5 font-semibold min-w-0">
            <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-plot shrink-0">plotLAB</span>
            <span className="truncate max-w-[120px] font-mono text-slate-300">{settings.deviceName}</span>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Server className={`w-3 h-3 ${settings.supabaseConfigured ? 'text-emerald-500' : 'text-slate-500'}`} />
            <Wifi className="w-3 h-3 text-slate-300" />
            <Signal className="w-3 h-3 text-slate-300" />
            <Battery className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            <span className="font-mono text-slate-300 font-bold">
              {currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          </div>
        </div>

        {/* Top Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-3 py-2.5 flex justify-between items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-plot flex items-center justify-center text-white shadow-md shadow-plot-dim/40 shrink-0">
              <Fingerprint className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-white tracking-tight text-sm leading-none">plotLAB</h1>
              <p className="text-[8px] text-plot font-bold uppercase tracking-wider mt-0.5 truncate">Reloj biométrico</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {settings.supabaseConfigured ? (
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg text-[9px] font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>RRHH</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg text-[9px] font-bold text-amber-500">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>.env</span>
              </div>
            )}
            
            <button
              onClick={handleOpenSettingsClick}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
              id="btn-settings-open"
              title="Configuración de Administrador"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Config</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden bg-slate-950 p-2 flex flex-col min-h-0">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
              <div className="w-9 h-9 border-4 border-plot border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-semibold tracking-wider uppercase font-mono text-slate-400">Cargando...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full min-h-0">
              <ClockInTerminal 
                onRecordAdded={fetchRecords} 
                employeesCount={employees.length} 
              />
            </div>
          )}
        </div>

        {/* Navigation Bar */}
        <div className="bg-slate-950 border-t border-slate-900 py-2.5 flex justify-center items-center gap-12 select-none shrink-0">
          <button 
            onClick={() => {
              if (isSettingsOpen) {
                setIsSettingsOpen(false);
              } else {
                alert("La terminal está en modo kiosco protegido.");
              }
            }} 
            className="w-10 h-8 flex items-center justify-center text-slate-500 hover:text-slate-300 transition active:scale-90"
            title="Atrás"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          
          <button 
            onClick={() => setIsSettingsOpen(false)} 
            className="w-10 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 transition active:scale-90"
            title="Inicio"
          >
            <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-400" />
          </button>
          
          <button 
            onClick={() => alert("plotLAB • Reloj biométrico")} 
            className="w-10 h-8 flex items-center justify-center text-slate-500 hover:text-slate-300 transition active:scale-90"
            title="Recientes"
          >
            <div className="w-3 h-3 border-2 border-slate-500 rounded" />
          </button>
        </div>

      </div>

      {/* PASSCODE LOCK MODAL */}
      {isPasscodeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 z-40">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-[360px] w-full p-5 shadow-2xl relative">
            <button
              onClick={() => setIsPasscodeModalOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-2 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-plot/15 text-plot flex items-center justify-center mx-auto">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-white">Acceso de Administrador</h3>
              <p className="text-[11px] text-slate-400">Ingrese el PIN para configurar.</p>
            </div>

            <form onSubmit={handlePasscodeSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="PIN"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full text-center tracking-[0.5em] font-mono font-black text-xl px-4 py-3 bg-slate-950 rounded-2xl border border-slate-800 text-white placeholder-slate-700 focus:outline-none focus:border-plot"
                  required
                  autoFocus
                  maxLength={4}
                  id="input-passcode"
                />
                {passcodeError && (
                  <p className="text-center text-xs text-rose-500 font-semibold mt-2">{passcodeError}</p>
                )}
                <p className="text-[10px] text-center text-slate-500 mt-2">PIN: <span className="font-mono text-slate-400">1234</span></p>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-plot hover:bg-plot-dark text-white text-xs font-bold transition shadow-md"
                id="btn-confirm-passcode"
              >
                Desbloquear
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN PANEL — full screen móvil */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-40">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[390px] h-[min(844px,96dvh)] overflow-hidden flex flex-col shadow-2xl">
            
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex justify-between items-center shrink-0">
              <div className="min-w-0 pr-2">
                <h3 className="font-black text-white text-sm">Administración</h3>
                <p className="text-[10px] text-slate-400 truncate">API, rostros y bitácora</p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                id="btn-close-settings"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="bg-slate-950/50 border-b border-slate-800/60 px-2 py-2 flex gap-1 overflow-x-auto shrink-0">
              <button
                onClick={() => setSettingsTab('api')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold transition cursor-pointer whitespace-nowrap ${
                  settingsTab === 'api'
                    ? 'bg-plot text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                id="tab-settings-api"
              >
                <Server className="w-3 h-3" />
                <span>Dispositivo</span>
              </button>

              <button
                onClick={() => setSettingsTab('employees')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold transition cursor-pointer whitespace-nowrap ${
                  settingsTab === 'employees'
                    ? 'bg-plot text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                id="tab-settings-employees"
              >
                <Users className="w-3 h-3" />
                <span>Rostros</span>
              </button>

              <button
                onClick={() => setSettingsTab('records')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold transition cursor-pointer whitespace-nowrap ${
                  settingsTab === 'records'
                    ? 'bg-plot text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                id="tab-settings-records"
              >
                <FileSpreadsheet className="w-3 h-3" />
                <span>Bitácora</span>
              </button>
            </div>

            {/* Inner Content Area */}
            <div className="flex-1 overflow-y-auto p-3 bg-slate-900 text-slate-300 min-h-0">
              
              {/* TAB 1: Dispositivo / RRHH */}
              {settingsTab === 'api' && (
                <div className="space-y-4">
                  <div className="p-3 bg-plot/10 border border-plot/20 rounded-2xl flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-plot shrink-0 mt-0.5" />
                    <div className="text-[11px] text-plot-light leading-relaxed">
                      <p className="font-bold">Solo reconocimiento → plotLAB RRHH</p>
                      <p className="mt-1">
                        Gemini identifica el rostro y llama a <span className="font-mono text-white bg-slate-950 px-1 py-0.5 rounded">registrar_marcacion_tablet</span>. La asistencia queda en plotLAB.
                      </p>
                    </div>
                  </div>

                    <div className={`p-3 rounded-2xl border text-[11px] flex items-center gap-2 ${
                    settings.supabaseConfigured
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    {settings.supabaseConfigured ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>
                      {settings.supabaseConfigured
                        ? 'Supabase conectado'
                        : 'Faltan vars en este proyecto Vercel: SUPABASE_ANON_KEY (o SERVICE_ROLE). Guardá Production + Redeploy.'}
                    </span>
                  </div>

                  <form onSubmit={handleSaveSettings} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        Nombre del dispositivo
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Entrada planta"
                        value={deviceNameInput}
                        onChange={(e) => setDeviceNameInput(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-plot"
                        id="input-device-name"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        Device ID (dispositivo_id)
                      </label>
                      <input
                        type="text"
                        placeholder="plotlab-reloj-facial-1"
                        value={deviceIdInput}
                        onChange={(e) => setDeviceIdInput(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-xs focus:outline-none focus:border-plot font-mono"
                        id="input-device-id"
                      />
                    </div>

                    {settingsSaveSuccess && (
                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Guardado.</span>
                      </div>
                    )}

                    {settingsSaveError && (
                      <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400 text-[11px]">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{settingsSaveError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSavingSettings}
                      className="w-full py-2.5 px-3 bg-plot hover:bg-plot-dark text-white rounded-xl transition text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-plot/50"
                      id="btn-submit-settings"
                    >
                      {isSavingSettings ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <span>Guardar dispositivo</span>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 2: EMPLOYEES (read-only from RRHH) */}
              {settingsTab === 'employees' && (
                <EmployeeManager
                  employees={allEmployees.length ? allEmployees : employees}
                  onRefresh={handleRefreshEmployees}
                  isRefreshing={isRefreshingEmployees}
                />
              )}

              {/* TAB 3: RECORDS from RRHH */}
              {settingsTab === 'records' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Totales</span>
                      <h4 className="text-xl font-black text-white mt-0.5 font-mono">{records.length}</h4>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Entradas</span>
                      <h4 className="text-xl font-black text-emerald-400 mt-0.5 font-mono">{records.filter(r => r.type === 'entrada').length}</h4>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Salidas</span>
                      <h4 className="text-xl font-black text-rose-400 mt-0.5 font-mono">{records.filter(r => r.type === 'salida').length}</h4>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">En RRHH</span>
                      <h4 className="text-xl font-black text-plot mt-0.5 font-mono">
                        {records.length > 0
                          ? Math.round((records.filter(r => r.syncStatus === 'sincronizado').length / records.length) * 100)
                          : 0}%
                      </h4>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-slate-800 flex justify-between items-center">
                      <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Marcajes RRHH</h4>
                      <button
                        type="button"
                        onClick={fetchRecords}
                        className="text-[9px] font-bold text-plot cursor-pointer"
                      >
                        Actualizar
                      </button>
                    </div>
                    
                    {records.length === 0 ? (
                      <div className="p-8 text-center flex flex-col items-center justify-center">
                        <HelpCircle className="w-8 h-8 text-slate-700 mb-2" />
                        <p className="text-slate-400 font-bold text-xs">Sin marcajes</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800">
                        {records.map((rec) => (
                          <div key={rec.id} className="p-3 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-white font-bold text-xs block truncate">{rec.employeeName}</span>
                                <span className="text-[9px] text-slate-500 font-mono">{rec.employeeId}</span>
                              </div>
                              {rec.type === 'entrada' ? (
                                <span className="shrink-0 inline-flex items-center py-0.5 px-2 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">Entrada</span>
                              ) : (
                                <span className="shrink-0 inline-flex items-center py-0.5 px-2 rounded-full text-[9px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/25">Salida</span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                              <span className="font-mono">{new Date(rec.timestamp).toLocaleString('es-MX')}</span>
                              <span className="font-bold text-slate-200">{rec.confidence ? `${rec.confidence}%` : '—'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3" /> plotLAB
                              </span>
                              <button
                                onClick={() => setSelectedAuditRecord(rec)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg hover:text-white transition cursor-pointer"
                                title="Ver detalles"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedAuditRecord && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-[390px] w-full max-h-[96dvh] overflow-hidden shadow-2xl flex flex-col">
            
            <div className="p-4 border-b border-slate-800 bg-slate-950 text-white flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-2">
                <h3 className="font-bold text-sm text-slate-100">Ficha de marcaje</h3>
                <p className="text-[10px] text-slate-400">Verificación facial</p>
              </div>
              <button
                onClick={() => setSelectedAuditRecord(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1 overflow-y-auto min-h-0">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex justify-between items-start gap-2 text-xs">
                <div className="min-w-0">
                  <h4 className="font-bold text-white text-sm truncate">{selectedAuditRecord.employeeName}</h4>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    ID: <span className="font-mono text-plot font-bold">{selectedAuditRecord.employeeId}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Fecha</div>
                  <div className="text-[11px] font-bold text-slate-200 font-mono">
                    {new Date(selectedAuditRecord.timestamp).toLocaleString('es-MX')}
                  </div>
                  <span className={`inline-block text-[9px] uppercase tracking-wide font-black px-2 py-0.5 mt-1 rounded ${
                    selectedAuditRecord.type === 'entrada' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                  }`}>
                    {selectedAuditRecord.type}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center">
                    Referencia
                  </span>
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-950 flex items-center justify-center">
                    {employees.find(e => e.id === selectedAuditRecord.employeeId)?.photo ? (
                      <img
                        src={employees.find(e => e.id === selectedAuditRecord.employeeId)!.photo}
                        alt="Reference DB"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-slate-600 text-[10px]">Sin foto</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center">
                    Captura
                  </span>
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-950 flex items-center justify-center">
                    {selectedAuditRecord.capturedPhoto ? (
                      <img
                        src={selectedAuditRecord.capturedPhoto}
                        alt="Captured terminal"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-slate-600 text-[10px]">Sin captura</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-plot/5 border border-plot/15 rounded-2xl space-y-1 text-[11px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-plot/15 text-plot-light text-[9px] font-bold px-2 py-0.5 rounded uppercase">Gemini</span>
                  <span className="text-[11px] font-bold text-plot">{selectedAuditRecord.confidence}%</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {(selectedAuditRecord as any).reasoning || "Comparación biométrica validada."}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end gap-2 shrink-0">
              {selectedAuditRecord.syncStatus === 'fallido' && (
                <button
                  onClick={() => {
                    handleForceResync(selectedAuditRecord);
                    setSelectedAuditRecord(null);
                  }}
                  className="bg-plot hover:bg-plot-dark text-white font-bold py-2 px-4 rounded-xl text-[11px] transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sincronizar</span>
                </button>
              )}
              <button
                onClick={() => setSelectedAuditRecord(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-4 rounded-xl text-[11px] transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
