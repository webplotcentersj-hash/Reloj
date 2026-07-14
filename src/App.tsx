import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  Lock,
  Wifi,
  Battery,
  Signal,
  Server,
  ChevronRight,
} from 'lucide-react';
import ClockInTerminal from './components/ClockInTerminal';
import { Employee, TerminalSettings } from './types';

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<TerminalSettings>({
    deviceName: 'plotLAB Reloj Facial 1',
    deviceId: 'plotlab-reloj-facial-1',
    supabaseConfigured: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        setEmployees(await response.json());
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        setSettings(await response.json());
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([fetchEmployees(), fetchSettings()]);
      setIsLoading(false);
    })();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    setIsUnlocking(true);
    try {
      const response = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: passcode }),
      });
      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setPasscodeError(
          `Error de servidor (${response.status}). Redeploy en Vercel o revisá /api/unlock.`
        );
        return;
      }
      if (response.ok && data.unlocked) {
        setUnlocked(true);
        setPasscode('');
        fetchEmployees();
      } else {
        setPasscodeError(data.error || 'Código incorrecto');
        setPasscode('');
      }
    } catch {
      setPasscodeError('Error de red');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div
      className="min-h-dvh bg-[#0c0a08] flex items-center justify-center p-3 sm:p-6 font-sans selection:bg-plot/10 selection:text-plot"
      id="app-root"
    >
      <div className="w-full max-w-[390px] h-[min(844px,100dvh)] sm:h-[min(844px,calc(100dvh-3rem))] bg-slate-900 rounded-[28px] sm:rounded-[36px] border-[5px] sm:border-8 border-slate-800 shadow-2xl overflow-hidden flex flex-col relative">
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-30 w-24 h-6 bg-slate-950 rounded-full pointer-events-none hidden sm:block"
          aria-hidden
        />

        <div className="bg-slate-950 text-slate-400 px-4 pt-2 pb-1.5 flex justify-between items-center text-[10px] select-none shrink-0 relative z-20">
          <div className="flex items-center gap-1.5 font-semibold min-w-0">
            <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-plot shrink-0">
              plotLAB
            </span>
            <span className="truncate max-w-[120px] font-mono text-slate-300">
              {settings.deviceName}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Server
              className={`w-3 h-3 ${settings.supabaseConfigured ? 'text-emerald-500' : 'text-slate-500'}`}
            />
            <Wifi className="w-3 h-3 text-slate-300" />
            <Signal className="w-3 h-3 text-slate-300" />
            <Battery className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            <span className="font-mono text-slate-300 font-bold">
              {currentTime.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border-b border-slate-800 px-3 py-2.5 flex justify-between items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-plot flex items-center justify-center text-white shadow-md shadow-plot-dim/40 shrink-0">
              <Fingerprint className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-white tracking-tight text-sm leading-none">
                plotLAB
              </h1>
              <p className="text-[8px] text-plot font-bold uppercase tracking-wider mt-0.5 truncate">
                Reloj biométrico
              </p>
            </div>
          </div>

          {unlocked && (
            <div
              className={`flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg text-[9px] font-bold ${
                settings.supabaseConfigured ? 'text-emerald-400' : 'text-amber-500'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  settings.supabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span>{settings.supabaseConfigured ? 'RRHH' : 'Sin env'}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden bg-slate-950 p-2 flex flex-col min-h-0">
          {!unlocked ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4 gap-5">
              <div className="w-14 h-14 rounded-2xl bg-plot/15 text-plot flex items-center justify-center">
                <Lock className="w-7 h-7" />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-base font-black text-white">Ingresá el código</h2>
                <p className="text-[11px] text-slate-400">
                  Configuración desde Vercel. Solo el PIN abre la terminal.
                </p>
              </div>
              <form onSubmit={handlePasscodeSubmit} className="w-full max-w-[260px] space-y-3">
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="w-full text-center tracking-[0.5em] font-mono font-black text-2xl px-4 py-3.5 bg-slate-900 rounded-2xl border border-slate-800 text-white placeholder-slate-700 focus:outline-none focus:border-plot"
                  required
                  autoFocus
                  maxLength={8}
                  id="input-passcode"
                  disabled={isUnlocking}
                />
                {passcodeError && (
                  <p className="text-center text-xs text-rose-500 font-semibold">{passcodeError}</p>
                )}
                <button
                  type="submit"
                  disabled={isUnlocking || passcode.length < 1}
                  className="w-full py-3.5 rounded-2xl bg-plot hover:bg-plot-dark text-white text-sm font-bold transition shadow-md disabled:opacity-50 cursor-pointer"
                  id="btn-confirm-passcode"
                >
                  {isUnlocking ? 'Verificando...' : 'Entrar'}
                </button>
              </form>
            </div>
          ) : isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
              <div className="w-9 h-9 border-4 border-plot border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-semibold tracking-wider uppercase font-mono text-slate-400">
                Cargando...
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full min-h-0">
              <ClockInTerminal
                onRecordAdded={fetchEmployees}
                employeesCount={employees.length}
              />
            </div>
          )}
        </div>

        <div className="bg-slate-950 border-t border-slate-900 py-2.5 flex justify-center items-center gap-12 select-none shrink-0">
          <button
            type="button"
            onClick={() => {
              if (unlocked) {
                setUnlocked(false);
                setPasscode('');
              }
            }}
            className="w-10 h-8 flex items-center justify-center text-slate-500 hover:text-slate-300 transition active:scale-90"
            title="Bloquear"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => {
              setUnlocked(false);
              setPasscode('');
            }}
            className="w-10 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 transition active:scale-90"
            title="Inicio"
          >
            <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-400" />
          </button>
          <button
            type="button"
            onClick={() => alert('plotLAB Reloj — config en Vercel')}
            className="w-10 h-8 flex items-center justify-center text-slate-500 hover:text-slate-300 transition active:scale-90"
            title="Info"
          >
            <div className="w-3 h-3 border-2 border-slate-500 rounded" />
          </button>
        </div>
      </div>
    </div>
  );
}
