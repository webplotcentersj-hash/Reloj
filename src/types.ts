export interface Employee {
  id: string;
  name: string;
  role: string;
  photo: string;
  login?: string;
  entradaHoy?: string | null;
  salidaHoy?: string | null;
  tieneFoto?: boolean;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  timestamp: string;
  type: 'entrada' | 'salida';
  capturedPhoto: string;
  confidence: number;
  syncStatus?: 'no_configurado' | 'sincronizado' | 'fallido';
  syncError?: string;
  reasoning?: string;
  dispositivoId?: string;
}

export interface TerminalSettings {
  deviceName: string;
  deviceId?: string;
  supabaseConfigured?: boolean;
  webhookUrl?: string;
  webhookToken?: string;
}
