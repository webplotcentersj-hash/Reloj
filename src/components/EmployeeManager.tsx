import { HelpCircle, User, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Employee } from '../types';

interface EmployeeManagerProps {
  employees: Employee[];
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export default function EmployeeManager({ employees, onRefresh, isRefreshing }: EmployeeManagerProps) {
  const withPhoto = employees.filter((e) => e.tieneFoto !== false && e.photo);
  const withoutPhoto = employees.filter((e) => e.tieneFoto === false || !e.photo);

  return (
    <div className="flex flex-col gap-4" id="employee-manager">
      <div className="p-3 bg-plot/10 border border-plot/20 rounded-2xl flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-plot shrink-0 mt-0.5" />
        <div className="text-[11px] text-plot-light leading-relaxed">
          <p className="font-bold text-plot">Fotos desde plotLAB RRHH</p>
          <p className="mt-1">
            Este terminal solo reconoce rostros. Las fotos de referencia se cargan en el legajo del empleado en plotLAB.
          </p>
        </div>
      </div>

      <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <User className="w-4 h-4 text-plot" />
              <span>Legajos con foto</span>
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {withPhoto.length} listos · {withoutPhoto.length} sin foto
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
            id="btn-refresh-employees"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>

        {employees.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[120px]">
            <HelpCircle className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-slate-300 font-semibold text-xs mb-0.5">Sin empleados</p>
            <p className="text-[10px] text-slate-500">Verifique la conexión a Supabase / plotLAB.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
            {withPhoto.map((emp) => (
              <div
                key={emp.id}
                className="p-3 border border-slate-800 rounded-xl flex items-start gap-3 bg-slate-900"
              >
                <img
                  src={emp.photo}
                  alt={emp.name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0 bg-slate-800"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-xs truncate leading-tight">{emp.name}</h4>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{emp.role}</p>
                  <p className="text-[9px] text-slate-500 font-mono mt-0.5">ID: {emp.id}</p>
                  <div className="flex gap-2 mt-1 text-[9px]">
                    {emp.entradaHoy ? (
                      <span className="text-emerald-400">E {emp.entradaHoy}</span>
                    ) : (
                      <span className="text-slate-600">Sin entrada</span>
                    )}
                    {emp.salidaHoy ? (
                      <span className="text-rose-400">S {emp.salidaHoy}</span>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> OK
                </span>
              </div>
            ))}

            {withoutPhoto.length > 0 && (
              <>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pt-2">
                  Sin foto de legajo
                </p>
                {withoutPhoto.map((emp) => (
                  <div
                    key={emp.id}
                    className="p-3 border border-slate-800/80 rounded-xl flex items-center gap-3 bg-slate-950/50 opacity-70"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-slate-300 text-xs truncate">{emp.name}</h4>
                      <p className="text-[9px] text-amber-500/90">Cargar foto en legajo RRHH</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
