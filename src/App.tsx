import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Users, 
  FileSpreadsheet, 
  Fingerprint, 
  Calendar, 
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
  ShieldCheck,
  Eye,
  LogOut,
  X
} from 'lucide-react';
import ClockInTerminal from './components/ClockInTerminal';
import EmployeeManager from './components/EmployeeManager';
import { Employee, AttendanceRecord, TerminalSettings } from './types';

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<TerminalSettings>({
    webhookUrl: '',
    webhookToken: '',
    deviceName: 'Dispositivo Android Reloj 1'
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  
  const [settingsTab, setSettingsTab] = useState<'api' | 'employees' | 'records'>('api');
  
  // Settings form fields
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [webhookTokenInput, setWebhookTokenInput] = useState('');
  const [deviceNameInput, setDeviceNameInput] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState('');

  // Active sync status overview
  const [isTestingSync, setIsTestingSync] = useState(false);
  const [testSyncResult, setTestSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // Detail Modal for historical records
  const [selectedAuditRecord, setSelectedAuditRecord] = useState<AttendanceRecord | null>(null);

  // Real-time clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch employees, attendance records and settings
  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
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
        setWebhookUrlInput(data.webhookUrl || '');
        setWebhookTokenInput(data.webhookToken || '');
        setDeviceNameInput(data.deviceName || 'Dispositivo Android Reloj 1');
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([fetchEmployees(), fetchRecords(), fetchSettings()]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();

    // Setup ticking clock
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleOpenSettingsClick = () => {
    // Open passcode modal first to protect admin section
    setPasscode('');
    setPasscodeError('');
    setIsPasscodeModalOpen(true);
  };

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === '1234') {
      setIsPasscodeModalOpen(false);
      setIsSettingsOpen(true);
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
          webhookUrl: webhookUrlInput.trim(),
          webhookToken: webhookTokenInput.trim(),
          deviceName: deviceNameInput.trim() || 'Dispositivo Android Reloj 1'
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSettings(data.settings);
        setSettingsSaveSuccess(true);
        // Refresh local data to show the correct device name
        fetchSettings();
      } else {
        setSettingsSaveError(data.error || 'Error al guardar configuraciones');
      }
    } catch (err: any) {
      setSettingsSaveError(err.message || 'Error de red');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrlInput.trim()) {
      setTestSyncResult({ success: false, message: 'Configure una URL de Webhook primero.' });
      return;
    }
    setIsTestingSync(true);
    setTestSyncResult(null);

    try {
      const response = await fetch(webhookUrlInput.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhookTokenInput ? { 'Authorization': `Bearer ${webhookTokenInput}` } : {})
        },
        body: JSON.stringify({
          event: "test_connection",
          deviceName: deviceNameInput || "Test Device",
          timestamp: new Date().toISOString(),
          message: "Prueba de conectividad del Reloj Biométrico Android"
        })
      });

      if (response.ok) {
        setTestSyncResult({ 
          success: true, 
          message: `¡Conexión exitosa! El servidor externo respondió con estado ${response.status}.` 
        });
      } else {
        setTestSyncResult({ 
          success: false, 
          message: `Fallo en la conexión: HTTP ${response.status} ${response.statusText}` 
        });
      }
    } catch (err: any) {
      setTestSyncResult({ 
        success: false, 
        message: `Error de red al intentar conectar: ${err.message || 'Sin respuesta'}` 
      });
    } finally {
      setIsTestingSync(false);
    }
  };

  const handleForceResync = async (record: AttendanceRecord) => {
    try {
      // Trigger a re-sync through a simulated test or direct post
      if (!settings.webhookUrl) return;
      
      const response = await fetch(settings.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.webhookToken ? { 'Authorization': `Bearer ${settings.webhookToken}` } : {})
        },
        body: JSON.stringify({
          event: "attendance_record",
          deviceName: settings.deviceName,
          timestamp: new Date().toISOString(),
          record: {
            id: record.id,
            employeeId: record.employeeId,
            employeeName: record.employeeName,
            timestamp: record.timestamp,
            type: record.type,
            confidence: record.confidence
          }
        })
      });

      if (response.ok) {
        alert("¡Registro re-sincronizado con éxito!");
        // We reload records to get latest status if stored
        fetchRecords();
      } else {
        alert(`Error al sincronizar: HTTP ${response.status}`);
      }
    } catch (err: any) {
      alert(`Error de red: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-0 md:p-6 font-sans selection:bg-indigo-500/10 selection:text-indigo-400" id="app-root">
      
      {/* Simulate Physical Android Tablet Frame */}
      <div className="w-full max-w-4xl bg-slate-900 md:rounded-[36px] md:border-8 md:border-slate-800 shadow-2xl overflow-hidden flex flex-col relative aspect-auto md:aspect-[4/3] min-h-screen md:min-h-[680px]">
        
        {/* Android Status Bar */}
        <div className="bg-slate-950 text-slate-400 px-5 py-2 flex justify-between items-center text-xs select-none">
          {/* Operator name & Device name */}
          <div className="flex items-center gap-2 font-semibold">
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-indigo-400">Android Reloj</span>
            <span className="truncate max-w-[150px] font-mono text-slate-300">{settings.deviceName}</span>
          </div>
          
          {/* Icons Bar */}
          <div className="flex items-center gap-3">
            <Server className={`w-3.5 h-3.5 ${settings.webhookUrl ? 'text-emerald-500' : 'text-slate-500'}`} title={settings.webhookUrl ? "Sincronización de Recursos Humanos configurada" : "No configurado"} />
            <Wifi className="w-3.5 h-3.5 text-slate-300" />
            <Signal className="w-3.5 h-3.5 text-slate-300" />
            <Battery className="w-4 h-4 text-emerald-400 fill-emerald-400" />
            <span className="font-mono text-[10px] text-slate-300 font-bold">100%</span>
            <span className="font-mono text-slate-300 font-bold border-l border-slate-800 pl-2.5">
              {currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          </div>
        </div>

        {/* Top Header of the Application Inside Tablet */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-900/30">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-white tracking-tight text-sm leading-none">BioClock</h1>
              <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider mt-1">Terminal de Asistencia Android</p>
            </div>
          </div>

          {/* Configuration and Sync Info */}
          <div className="flex items-center gap-3">
            {settings.webhookUrl ? (
              <div className="hidden sm:flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Enlazado a Recursos Humanos</span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-bold text-amber-500">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Solo Modo Local</span>
              </div>
            )}
            
            <button
              onClick={handleOpenSettingsClick}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold"
              id="btn-settings-open"
              title="Configuración de Administrador"
            >
              <Settings className="w-4 h-4" />
              <span>Configurar</span>
            </button>
          </div>
        </div>

        {/* Main Content Pane inside Tablet */}
        <div className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-6 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-semibold tracking-wider uppercase font-mono text-slate-400">Cargando base biométrica...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full">
              <ClockInTerminal 
                onRecordAdded={fetchRecords} 
                employeesCount={employees.length} 
              />
            </div>
          )}
        </div>

        {/* Android Navigation Bar At the Bottom */}
        <div className="bg-slate-950 border-t border-slate-900 py-3 flex justify-center items-center gap-16 select-none">
          {/* Back Button */}
          <button 
            onClick={() => {
              if (isSettingsOpen) {
                setIsSettingsOpen(false);
              } else {
                alert("La terminal está ejecutándose en modo kiosco protegido.");
              }
            }} 
            className="w-12 h-10 flex items-center justify-center text-slate-500 hover:text-slate-300 transition active:scale-90"
            title="Atrás"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          
          {/* Home Button */}
          <button 
            onClick={() => setIsSettingsOpen(false)} 
            className="w-12 h-10 flex items-center justify-center text-slate-400 hover:text-slate-200 transition active:scale-90"
            title="Inicio"
          >
            <div className="w-4 h-4 rounded-full border-2 border-slate-400" />
          </button>
          
          {/* Recents App Button */}
          <button 
            onClick={() => alert("BioClock de Recursos Humanos • Potenciado por Gemini 3.5")} 
            className="w-12 h-10 flex items-center justify-center text-slate-500 hover:text-slate-300 transition active:scale-90"
            title="Recientes"
          >
            <div className="w-3.5 h-3.5 border-2 border-slate-500 rounded" />
          </button>
        </div>

      </div>

      {/* PASSCODE LOCK MODAL */}
      {isPasscodeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-40">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsPasscodeModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-2 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center mx-auto">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-white">Acceso de Administrador</h3>
              <p className="text-[11px] text-slate-400">Ingrese el código PIN para configurar la terminal.</p>
            </div>

            <form onSubmit={handlePasscodeSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="PIN de Seguridad"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full text-center tracking-[0.5em] font-mono font-black text-xl px-4 py-3 bg-slate-950 rounded-2xl border border-slate-800 text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500"
                  required
                  autoFocus
                  maxLength={4}
                  id="input-passcode"
                />
                {passcodeError && (
                  <p className="text-center text-xs text-rose-500 font-semibold mt-2">{passcodeError}</p>
                )}
                <p className="text-[10px] text-center text-slate-500 mt-2">Código PIN predeterminado: <span className="font-mono text-slate-400">1234</span></p>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md"
                id="btn-confirm-passcode"
              >
                Desbloquear Ajustes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN CONTEXT DIALOG / CONFIGURATION OVERLAY PANEL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-40">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full h-[90vh] md:h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
              <div>
                <h3 className="font-black text-white text-base">Panel de Administración de la Terminal</h3>
                <p className="text-[11px] text-slate-400">Configure sincronizaciones externas y base de datos facial</p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                id="btn-close-settings"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de Pestañas del Administrador */}
            <div className="bg-slate-950/50 border-b border-slate-800/60 px-6 py-2 flex gap-1.5 overflow-x-auto">
              <button
                onClick={() => setSettingsTab('api')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  settingsTab === 'api'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                id="tab-settings-api"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Enlace API (Recursos Humanos)</span>
              </button>

              <button
                onClick={() => setSettingsTab('employees')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  settingsTab === 'employees'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                id="tab-settings-employees"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Registro de Rostros</span>
              </button>

              <button
                onClick={() => setSettingsTab('records')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  settingsTab === 'records'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                id="tab-settings-records"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Bitácora & Auditoría</span>
              </button>
            </div>

            {/* Inner Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-900 text-slate-300">
              
              {/* TAB 1: API SETTINGS FORM */}
              {settingsTab === 'api' && (
                <div className="max-w-xl mx-auto space-y-6">
                  <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-start gap-3">
                    <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-indigo-300 leading-relaxed">
                      <p className="font-bold">¿Cómo funciona la integración?</p>
                      <p className="mt-1">Cada vez que un empleado es identificado por el reconocimiento facial biométrico de Gemini, esta terminal envía automáticamente una solicitud <span className="font-mono text-white bg-slate-950 px-1 py-0.5 rounded">POST</span> en formato JSON al webhook configurado a continuación. Esto le permite centralizar la información en su propio sistema de Recursos Humanos.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        Nombre / Identificador de la Terminal
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Entrada Oficina Principal"
                        value={deviceNameInput}
                        onChange={(e) => setDeviceNameInput(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500"
                        id="input-device-name"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Ayuda a identificar cuál reloj envió el marcaje.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        URL de Webhook (API Externa RRHH)
                      </label>
                      <input
                        type="url"
                        placeholder="https://su-sistema-rrhh.com/api/asistencia"
                        value={webhookUrlInput}
                        onChange={(e) => setWebhookUrlInput(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                        id="input-webhook-url"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">El endpoint REST o webhook que recibirá los logs en tiempo real.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        Token de Autorización (Opcional Bearer Token)
                      </label>
                      <input
                        type="password"
                        placeholder="Bearer Token o Llave Secreta de API"
                        value={webhookTokenInput}
                        onChange={(e) => setWebhookTokenInput(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                        id="input-webhook-token"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Se enviará en la cabecera "Authorization" como Bearer Token.</p>
                    </div>

                    {/* Feedback Status */}
                    {settingsSaveSuccess && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-xs">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>Configuración guardada exitosamente.</span>
                      </div>
                    )}

                    {settingsSaveError && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400 text-xs">
                        <XCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{settingsSaveError}</span>
                      </div>
                    )}

                    {/* Form Controls */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleTestWebhook}
                        disabled={isTestingSync || !webhookUrlInput}
                        className="flex-1 py-3 px-4 rounded-xl border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        id="btn-test-sync"
                      >
                        {isTestingSync ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Probando...</span>
                          </>
                        ) : (
                          <>
                            <Server className="w-3.5 h-3.5" />
                            <span>Probar Conexión</span>
                          </>
                        )}
                      </button>

                      <button
                        type="submit"
                        disabled={isSavingSettings}
                        className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:bg-indigo-400"
                        id="btn-submit-settings"
                      >
                        {isSavingSettings ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Guardando...</span>
                          </>
                        ) : (
                          <span>Guardar Ajustes</span>
                        )}
                      </button>
                    </div>

                    {/* Test Results Display */}
                    {testSyncResult && (
                      <div className={`p-4 rounded-xl border mt-3 text-xs flex gap-2.5 items-start ${
                        testSyncResult.success 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      }`}>
                        {testSyncResult.success ? (
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-bold">{testSyncResult.success ? 'Prueba Exitosa' : 'Prueba Fallida'}</p>
                          <p className="mt-0.5 leading-relaxed">{testSyncResult.message}</p>
                        </div>
                      </div>
                    )}

                  </form>
                </div>
              )}

              {/* TAB 2: REGISTER EMPLOYEE FACES (LOCAL DIRECTORY) */}
              {settingsTab === 'employees' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                      Para que la inteligencia de visión artificial de <strong>Google Gemini</strong> reconozca rostros en la terminal de forma local, debe registrar los empleados asignándoles una foto nítida de frente y su código ID correspondiente. No se requiere conexión a internet para esta base biométrica local ya que las referencias se almacenan de manera segura en el dispositivo.
                    </p>
                  </div>
                  <EmployeeManager 
                    employees={employees}
                    onEmployeeAdded={fetchEmployees}
                    onEmployeeDeleted={fetchEmployees}
                  />
                </div>
              )}

              {/* TAB 3: ATTENDANCE RECORDS LOG & MANUAL RE-SYNC */}
              {settingsTab === 'records' && (
                <div className="space-y-6">
                  {/* Stats Overview */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Marcajes Totales</span>
                      <h4 className="text-2xl font-black text-white mt-1 font-mono">{records.length}</h4>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Entradas</span>
                      <h4 className="text-2xl font-black text-emerald-400 mt-1 font-mono">{records.filter(r => r.type === 'entrada').length}</h4>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Salidas</span>
                      <h4 className="text-2xl font-black text-rose-400 mt-1 font-mono">{records.filter(r => r.type === 'salida').length}</h4>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tasa Sincronización</span>
                      <h4 className="text-2xl font-black text-indigo-400 mt-1 font-mono">
                        {records.length > 0 
                          ? Math.round((records.filter(r => r.syncStatus === 'sincronizado').length / records.length) * 100)
                          : 0}%
                      </h4>
                    </div>
                  </div>

                  {/* Logs Table */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Bitácora de Marcajes del Dispositivo</h4>
                    </div>
                    
                    <div className="overflow-x-auto">
                      {records.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center">
                          <HelpCircle className="w-10 h-10 text-slate-700 mb-2" />
                          <p className="text-slate-400 font-bold text-sm">No hay marcajes de asistencia</p>
                          <p className="text-xs text-slate-600 mt-1">Los marcajes generados en el reloj se registrarán en esta sección.</p>
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold text-xs uppercase tracking-wider">
                              <th className="py-3 px-5">Empleado</th>
                              <th className="py-3 px-5">Evento</th>
                              <th className="py-3 px-5">Fecha y Hora</th>
                              <th className="py-3 px-5">Gemini Similarity</th>
                              <th className="py-3 px-5">Sincronización RRHH</th>
                              <th className="py-3 px-5 text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-slate-300 text-xs">
                            {records.map((rec) => (
                              <tr key={rec.id} className="hover:bg-slate-900/50 transition">
                                <td className="py-3.5 px-5 font-bold">
                                  <div>
                                    <span className="text-white block">{rec.employeeName}</span>
                                    <span className="text-[10px] text-slate-500 font-mono font-semibold">{rec.employeeId}</span>
                                  </div>
                                </td>
                                
                                <td className="py-3.5 px-5">
                                  {rec.type === 'entrada' ? (
                                    <span className="inline-flex items-center py-0.5 px-2 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">Entrada</span>
                                  ) : (
                                    <span className="inline-flex items-center py-0.5 px-2 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/25">Salida</span>
                                  )}
                                </td>

                                <td className="py-3.5 px-5 font-mono text-slate-400">
                                  {new Date(rec.timestamp).toLocaleString('es-MX')}
                                </td>

                                <td className="py-3.5 px-5">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                                    <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                      <div className="h-full bg-indigo-500" style={{ width: `${rec.confidence}%` }} />
                                    </div>
                                    <span>{rec.confidence}%</span>
                                  </div>
                                </td>

                                <td className="py-3.5 px-5">
                                  {rec.syncStatus === 'sincronizado' ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold" title="Sincronizado correctamente">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Sincronizado</span>
                                    </span>
                                  ) : rec.syncStatus === 'fallido' ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="inline-flex items-center gap-1 text-rose-400 font-bold" title={rec.syncError || "Error desconocido"}>
                                        <XCircle className="w-3.5 h-3.5" />
                                        <span>Fallo Sync</span>
                                      </span>
                                      <span className="text-[8px] text-slate-500 truncate max-w-[120px] font-mono">{rec.syncError}</span>
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-slate-500 font-semibold">
                                      <Info className="w-3.5 h-3.5" />
                                      <span>Local</span>
                                    </span>
                                  )}
                                </td>

                                <td className="py-3.5 px-5 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => setSelectedAuditRecord(rec)}
                                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg hover:text-white transition cursor-pointer"
                                      title="Ver Detalles y Comparación Facial"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    {rec.syncStatus === 'fallido' && (
                                      <button
                                        onClick={() => handleForceResync(rec)}
                                        className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg transition cursor-pointer"
                                        title="Reintentar Sincronización Externa"
                                      >
                                        <RefreshCw className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: HISTORICAL LOG / BIOMETRIC AUDIT */}
      {selectedAuditRecord && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col">
            
            <div className="p-5 border-b border-slate-800 bg-slate-950 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-100">Ficha Técnica de Marcaje Biométrico</h3>
                <p className="text-xs text-slate-400">Verificación facial mediante Inteligencia Artificial</p>
              </div>
              <button
                onClick={() => setSelectedAuditRecord(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              
              {/* Employee metadata */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex justify-between items-center flex-wrap gap-4 text-xs">
                <div>
                  <h4 className="font-bold text-white text-base">{selectedAuditRecord.employeeName}</h4>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    ID de Personal: <span className="font-mono text-indigo-400 font-bold">{selectedAuditRecord.employeeId}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fecha de Registro</div>
                  <div className="text-sm font-bold text-slate-200 font-mono">
                    {new Date(selectedAuditRecord.timestamp).toLocaleString('es-MX')}
                  </div>
                  <span className={`inline-block text-[10px] uppercase tracking-wide font-black px-2 py-0.5 mt-1 rounded ${
                    selectedAuditRecord.type === 'entrada' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                  }`}>
                    {selectedAuditRecord.type}
                  </span>
                </div>
              </div>

              {/* Side-by-side Photos comparison */}
              <div className="grid grid-cols-2 gap-6">
                
                {/* 1. Reference Photo */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    Foto de Referencia (DB Local)
                  </span>
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-950 flex items-center justify-center shadow-inner">
                    {employees.find(e => e.id === selectedAuditRecord.employeeId)?.photo ? (
                      <img
                        src={employees.find(e => e.id === selectedAuditRecord.employeeId)!.photo}
                        alt="Reference DB"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-slate-600 text-xs">Sin foto de referencia</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 text-center italic leading-tight">
                    Imagen de referencia cargada en el registro de personal
                  </p>
                </div>

                {/* 2. Captured Photo */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    Captura del Checador
                  </span>
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-950 flex items-center justify-center shadow-inner">
                    {selectedAuditRecord.capturedPhoto ? (
                      <img
                        src={selectedAuditRecord.capturedPhoto}
                        alt="Captured terminal"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-slate-600 text-xs">Sin captura guardada</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 text-center italic leading-tight">
                    Foto capturada por la terminal al realizar el registro
                  </p>
                </div>

              </div>

              {/* Gemini analysis text */}
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl space-y-1.5 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-indigo-500/15 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Análisis Facial Biométrico Gemini</span>
                  <span className="text-xs font-bold text-indigo-400">Similitud: {selectedAuditRecord.confidence}%</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {(selectedAuditRecord as any).reasoning || "Comparación biométrica realizada con éxito. La inteligencia de visión artificial de Google Gemini analizó los rasgos estructurales del rostro y validó la identidad del empleado."}
                </p>
              </div>

            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              {selectedAuditRecord.syncStatus === 'fallido' && (
                <button
                  onClick={() => {
                    handleForceResync(selectedAuditRecord);
                    setSelectedAuditRecord(null);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sincronizar Ahora</span>
                </button>
              )}
              <button
                onClick={() => setSelectedAuditRecord(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-5 rounded-xl text-xs transition cursor-pointer"
              >
                Cerrar Ficha
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
