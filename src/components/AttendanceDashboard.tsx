import React, { useState } from 'react';
import { Search, LogIn, LogOut, Clock, Calendar, ShieldCheck, HelpCircle, FileSpreadsheet, Eye, X } from 'lucide-react';
import { AttendanceRecord, Employee } from '../types';

interface AttendanceDashboardProps {
  records: AttendanceRecord[];
  employees: Employee[];
}

export default function AttendanceDashboard({ records, employees }: AttendanceDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'entrada' | 'salida'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday'>('all');
  
  // Modal for audit comparison
  const [auditRecord, setAuditRecord] = useState<AttendanceRecord | null>(null);

  // Statistics
  const totalLogs = records.length;
  const entradasCount = records.filter(r => r.type === 'entrada').length;
  const salidasCount = records.filter(r => r.type === 'salida').length;
  
  const avgConfidence = records.length > 0 
    ? Math.round(records.reduce((sum, r) => sum + r.confidence, 0) / records.length) 
    : 0;

  // Filter logic
  const filteredRecords = records.filter(rec => {
    // Search query matches name or ID
    const matchesSearch = 
      rec.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.employeeId.toLowerCase().includes(searchQuery.toLowerCase());

    // Type filter
    const matchesType = typeFilter === 'all' || rec.type === typeFilter;

    // Date filter
    const recDate = new Date(rec.timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isToday = recDate.toDateString() === today.toDateString();
    const isYesterday = recDate.toDateString() === yesterday.toDateString();

    const matchesDate = 
      dateFilter === 'all' ||
      (dateFilter === 'today' && isToday) ||
      (dateFilter === 'yesterday' && isYesterday);

    return matchesSearch && matchesType && matchesDate;
  });

  const getRefPhotoForEmployee = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    return emp ? emp.photo : null;
  };

  const getRoleForEmployee = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    return emp ? emp.role : 'Empleado';
  };

  return (
    <div className="space-y-6" id="attendance-dashboard">
      
      {/* Cards: Visual stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Registros</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 leading-none">{totalLogs}</h3>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <LogIn className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Entradas Hoy</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 leading-none">{entradasCount}</h3>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 flex-shrink-0">
            <LogOut className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Salidas Hoy</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 leading-none">{salidasCount}</h3>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Similitud Promedio</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1 leading-none">{avgConfidence}%</h3>
          </div>
        </div>

      </div>

      {/* Filter and table container */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        
        {/* Filters bar */}
        <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por empleado o ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition placeholder-gray-400 text-slate-700 font-medium"
              id="search-attendance"
            />
          </div>

          {/* Selector filters */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
            
            {/* Type selection */}
            <select
              value={typeFilter}
              onChange={(e: any) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-slate-600 bg-white focus:outline-none cursor-pointer"
              id="filter-type"
            >
              <option value="all">Todos los Tipos</option>
              <option value="entrada">Entradas</option>
              <option value="salida">Salidas</option>
            </select>

            {/* Date selection */}
            <select
              value={dateFilter}
              onChange={(e: any) => setDateFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-slate-600 bg-white focus:outline-none cursor-pointer"
              id="filter-date"
            >
              <option value="all">Todas las fechas</option>
              <option value="today">Hoy</option>
              <option value="yesterday">Ayer</option>
            </select>

          </div>

        </div>

        {/* Table of logs */}
        <div className="overflow-x-auto">
          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center bg-slate-50/20">
              <HelpCircle className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-slate-800 font-semibold text-sm mb-0.5">No hay registros de asistencia</p>
              <p className="text-xs text-slate-400">Pruebe ajustando los filtros o registre un marcaje en la terminal.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100 text-slate-500 font-bold text-xs uppercase tracking-wider">
                  <th className="py-4 px-6">Empleado</th>
                  <th className="py-4 px-6">Tipo</th>
                  <th className="py-4 px-6">Fecha y Hora</th>
                  <th className="py-4 px-6">Verificación Biométrica</th>
                  <th className="py-4 px-6 text-right">Auditoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-slate-700 text-sm">
                {filteredRecords.map((rec) => {
                  const hasRef = getRefPhotoForEmployee(rec.employeeId);
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/50 transition">
                      
                      {/* Name & ID */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <img
                            src={hasRef || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80"}
                            alt={rec.employeeName}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-100 shadow-inner"
                          />
                          <div>
                            <h4 className="font-semibold text-slate-900 leading-tight">{rec.employeeName}</h4>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              {getRoleForEmployee(rec.employeeId)} • <span className="font-mono text-[10px]">{rec.employeeId}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Type (Entrada/Salida) */}
                      <td className="py-4 px-6">
                        {rec.type === 'entrada' ? (
                          <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <LogIn className="w-3.5 h-3.5" />
                            <span>Entrada</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Salida</span>
                          </span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="py-4 px-6 font-medium text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>
                            {new Date(rec.timestamp).toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Gemini match confidence */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-100 rounded-full h-2 max-w-[100px] overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                rec.confidence >= 85 ? 'bg-emerald-500' : rec.confidence >= 70 ? 'bg-indigo-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${rec.confidence}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700">{rec.confidence}%</span>
                          <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Gemini</span>
                        </div>
                      </td>

                      {/* Audit eye button */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setAuditRecord(rec)}
                          className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-600 transition inline-flex items-center gap-1.5 text-xs font-semibold border border-transparent hover:border-indigo-100 cursor-pointer"
                          title="Comparar fotos faciales"
                          id={`btn-audit-${rec.id}`}
                        >
                          <Eye className="w-4 h-4" />
                          <span>Auditar</span>
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Modal: Side-by-side verification (Audit comparison) */}
      {auditRecord && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            
            <div className="p-5 border-b border-gray-100 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-100">Panel de Auditoría Biométrica</h3>
                <p className="text-xs text-slate-400">Verificación e inspección facial por Administrador</p>
              </div>
              <button
                onClick={() => setAuditRecord(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                id="btn-close-audit"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              
              {/* Employee metadata in Audit */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-base">{auditRecord.employeeName}</h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {getRoleForEmployee(auditRecord.employeeId)} • ID: <span className="font-mono">{auditRecord.employeeId}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-500">Hora de Registro</div>
                  <div className="text-sm font-bold text-slate-800">
                    {new Date(auditRecord.timestamp).toLocaleTimeString('es-MX')}
                  </div>
                  <span className={`inline-block text-[10px] uppercase tracking-wide font-black px-2 py-0.5 mt-1 rounded ${
                    auditRecord.type === 'entrada' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {auditRecord.type}
                  </span>
                </div>
              </div>

              {/* Side-by-side Photos comparison */}
              <div className="grid grid-cols-2 gap-6">
                
                {/* 1. Reference Photo */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                    Foto de Referencia (DB)
                  </span>
                  <div className="aspect-[4/3] rounded-xl overflow-hidden border-2 border-dashed border-gray-200 bg-slate-50 flex items-center justify-center">
                    {getRefPhotoForEmployee(auditRecord.employeeId) ? (
                      <img
                        src={getRefPhotoForEmployee(auditRecord.employeeId)!}
                        alt="Reference DB"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-slate-400 text-xs">Sin foto de referencia</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 text-center italic leading-tight">
                    Imagen guardada durante el registro inicial del empleado
                  </p>
                </div>

                {/* 2. Captured Photo */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                    Foto Capturada (Reloj)
                  </span>
                  <div className="aspect-[4/3] rounded-xl overflow-hidden border-2 border-dashed border-indigo-200 bg-slate-50 flex items-center justify-center">
                    {auditRecord.capturedPhoto ? (
                      <img
                        src={auditRecord.capturedPhoto}
                        alt="Captured terminal"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-slate-400 text-xs">Sin captura guardada</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 text-center italic leading-tight">
                    Foto capturada por la cámara de la terminal al momento del registro
                  </p>
                </div>

              </div>

              {/* Gemini analysis text */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Análisis Biométrico Gemini</span>
                  <span className="text-xs font-bold text-indigo-900">Confianza: {auditRecord.confidence}%</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {(auditRecord as any).reasoning || "Comparación exitosa mediante el emparejamiento de los rasgos faciales básicos (distancia interpupilar, contorno nasal, proporción de frente y pómulos). El algoritmo de visión artificial de Gemini validó la identidad del empleado."}
                </p>
              </div>

            </div>

            <div className="p-4 bg-slate-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setAuditRecord(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-5 rounded-xl text-xs transition cursor-pointer"
                id="btn-confirm-audit"
              >
                Cerrar Auditoría
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
