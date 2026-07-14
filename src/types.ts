export interface Employee {
  id: string;
  name: string;
  role: string;
  photo: string; // Base64 data URL
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  timestamp: string;
  type: 'entrada' | 'salida';
  capturedPhoto: string; // Base64 data URL at clock-in
  confidence: number; // Gemini recognition match confidence (0 - 100)
  syncStatus?: 'no_configurado' | 'sincronizado' | 'fallido';
  syncError?: string;
}

export interface TerminalSettings {
  webhookUrl: string;
  webhookToken: string;
  deviceName: string;
}
