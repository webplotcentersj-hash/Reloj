import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini API
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const DATA_DIR = path.join(process.cwd(), "data");
const EMPLOYEES_FILE = path.join(DATA_DIR, "employees.json");
const ATTENDANCE_FILE = path.join(DATA_DIR, "attendance.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(EMPLOYEES_FILE)) {
  fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(ATTENDANCE_FILE)) {
  fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
    webhookUrl: "",
    webhookToken: "",
    deviceName: "Dispositivo Android Reloj 1"
  }, null, 2));
}

// Helpers to read/write files
function readEmployees() {
  try {
    const data = fs.readFileSync(EMPLOYEES_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeEmployees(employees: any[]) {
  fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(employees, null, 2), "utf-8");
}

function readAttendance() {
  try {
    const data = fs.readFileSync(ATTENDANCE_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeAttendance(records: any[]) {
  fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(records, null, 2), "utf-8");
}

function readSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return { webhookUrl: "", webhookToken: "", deviceName: "Dispositivo Android Reloj 1" };
  }
}

function writeSettings(settings: any) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

function parseDataUrl(dataUrl: string) {
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return { mimeType: 'image/jpeg', data: dataUrl };
  }
  return {
    mimeType: matches[1],
    data: matches[2]
  };
}

async function triggerWebhook(record: any) {
  const settings = readSettings();
  if (!settings.webhookUrl) {
    return { status: "no_configurado" };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (settings.webhookToken) {
      headers["Authorization"] = `Bearer ${settings.webhookToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 seconds timeout

    const response = await fetch(settings.webhookUrl, {
      method: "POST",
      headers,
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
          confidence: record.confidence,
          reasoning: record.reasoning
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { status: "sincronizado" };
    } else {
      const respText = await response.text().catch(() => "");
      return { status: "fallido", error: `HTTP ${response.status}: ${response.statusText || ""} ${respText.slice(0, 100)}` };
    }
  } catch (err: any) {
    return { status: "fallido", error: err.message || "Error de red" };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use increased limits because of base64 images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get settings
  app.get("/api/settings", (req, res) => {
    try {
      const settings = readSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: "Error al leer configuraciones", details: err.message });
    }
  });

  // Save settings
  app.post("/api/settings", (req, res) => {
    try {
      const { webhookUrl, webhookToken, deviceName } = req.body;
      const settings = {
        webhookUrl: webhookUrl || "",
        webhookToken: webhookToken || "",
        deviceName: deviceName || "Dispositivo Android Reloj 1"
      };
      writeSettings(settings);
      res.json({ message: "Configuraciones guardadas con éxito", settings });
    } catch (err: any) {
      res.status(500).json({ error: "Error al guardar configuraciones", details: err.message });
    }
  });

  // Get list of employees
  app.get("/api/employees", (req, res) => {
    try {
      const employees = readEmployees();
      res.json(employees);
    } catch (err: any) {
      res.status(500).json({ error: "Error al leer empleados", details: err.message });
    }
  });

  // Create a new employee
  app.post("/api/employees", (req, res) => {
    try {
      const { id, name, role, photo } = req.body;
      if (!id || !name || !role || !photo) {
        return res.status(400).json({ error: "Todos los campos son obligatorios (ID, Nombre, Cargo, Foto)" });
      }

      const employees = readEmployees();
      if (employees.some((e: any) => e.id === id)) {
        return res.status(400).json({ error: "Ya existe un empleado registrado con ese ID" });
      }

      const newEmployee = {
        id,
        name,
        role,
        photo,
        createdAt: new Date().toISOString()
      };

      employees.push(newEmployee);
      writeEmployees(employees);
      res.status(201).json(newEmployee);
    } catch (err: any) {
      res.status(500).json({ error: "Error al guardar empleado", details: err.message });
    }
  });

  // Delete an employee
  app.delete("/api/employees/:id", (req, res) => {
    try {
      const { id } = req.params;
      let employees = readEmployees();
      const initialLength = employees.length;
      employees = employees.filter((e: any) => e.id !== id);

      if (employees.length === initialLength) {
        return res.status(404).json({ error: "Empleado no encontrado" });
      }

      writeEmployees(employees);
      res.json({ message: "Empleado eliminado exitosamente" });
    } catch (err: any) {
      res.status(500).json({ error: "Error al eliminar empleado", details: err.message });
    }
  });

  // Get attendance logs
  app.get("/api/attendance", (req, res) => {
    try {
      const attendance = readAttendance();
      res.json(attendance);
    } catch (err: any) {
      res.status(500).json({ error: "Error al leer asistencia", details: err.message });
    }
  });

  // Biometric Recognition & Record Entry/Exit
  app.post("/api/attendance/recognize", async (req, res) => {
    try {
      const { photo, type } = req.body;
      if (!photo || !type || (type !== 'entrada' && type !== 'salida')) {
        return res.status(400).json({ error: "La foto y el tipo ('entrada' o 'salida') son obligatorios." });
      }

      const employees = readEmployees();
      if (employees.length === 0) {
        return res.status(400).json({ 
          error: "No hay empleados registrados en la base de datos biométrica. Registre al menos un empleado antes de usar el reloj." 
        });
      }

      // 1. Prepare parts for Gemini
      const { mimeType: capturedMime, data: capturedData } = parseDataUrl(photo);
      const contentsParts: any[] = [];

      contentsParts.push({
        text: `Eres un sistema biométrico de reconocimiento facial de alta precisión en español.
Tu tarea es identificar a la persona en la 'Foto Capturada' comparándola con las 'Fotos de Referencia' de los empleados registrados.

Reglas críticas de comparación:
1. Analiza cuidadosamente la geometría facial, estructura de los ojos, nariz, boca, forma de la cara, cejas y mandíbula.
2. Ignora diferencias en iluminación, fondo, calidad de la cámara, expresión (sonreír o serio), peinado o uso de lentes cotidianos.
3. Si la persona de la 'Foto Capturada' es la misma que uno de los empleados de referencia, identifícalo indicando su ID exacto y un porcentaje de confianza realista (0-100%).
4. Si NO coincide claramente con nadie, o la confianza es extremadamente baja, marca 'matched' como false, 'employeeId' como null y confianza baja.
5. Brinda un análisis técnico, objetivo y breve de los rasgos en 'reasoning' en idioma español.`
      });

      // Add the captured photo to recognize
      contentsParts.push({
        text: `--- FOTO CAPTURADA ---
Esta es la persona que está intentando registrar su ${type} en el reloj biométrico en este momento.`
      });
      contentsParts.push({
        inlineData: {
          mimeType: capturedMime,
          data: capturedData
        }
      });

      // Add all registered employee references
      contentsParts.push({
        text: `--- FOTOS DE REFERENCIA DE EMPLEADOS ---
Compara la 'Foto Capturada' anterior con cada una de estas fotos de referencia de empleados:`
      });

      for (const emp of employees) {
        const { mimeType: refMime, data: refData } = parseDataUrl(emp.photo);
        contentsParts.push({
          text: `Empleado ID: "${emp.id}", Nombre Completo: "${emp.name}", Cargo: "${emp.role}"`
        });
        contentsParts.push({
          inlineData: {
            mimeType: refMime,
            data: refData
          }
        });
      }

      contentsParts.push({
        text: `Realiza la comparación y devuelve la respuesta en formato JSON estructurado.`
      });

      // 2. Query Gemini
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: contentsParts,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matched: {
                type: Type.BOOLEAN,
                description: "True si el rostro de la captura coincide con alguno de los empleados registrados."
              },
              employeeId: {
                type: Type.STRING,
                description: "El ID del empleado que coincide exactamente (ej. 'EMP-123'). Debe ser nulo si matched es false."
              },
              confidence: {
                type: Type.INTEGER,
                description: "Un entero de 0 a 100 que represente la confianza o similitud de rasgos faciales."
              },
              reasoning: {
                type: Type.STRING,
                description: "Explicación técnica en español de por qué coincide o por qué no coincide."
              }
            },
            required: ["matched", "employeeId", "confidence", "reasoning"]
          }
        }
      });

      const resultText = geminiResponse.text?.trim() || "{}";
      const matchResult = JSON.parse(resultText);

      if (matchResult.matched && matchResult.employeeId) {
        const matchedEmp = employees.find((e: any) => e.id === matchResult.employeeId);
        
        if (matchedEmp) {
          // Verify confidence is above a reasonable threshold, e.g. 60%
          if (matchResult.confidence >= 60) {
            const attendance = readAttendance();
            const newRecord: any = {
              id: "ATT-" + Date.now(),
              employeeId: matchedEmp.id,
              employeeName: matchedEmp.name,
              timestamp: new Date().toISOString(),
              type: type,
              capturedPhoto: photo, // Store the captured photo to keep historical log
              confidence: matchResult.confidence,
              reasoning: matchResult.reasoning,
              syncStatus: "no_configurado",
              syncError: ""
            };

            // Trigger real-time sync with external HR system
            const syncResult = await triggerWebhook(newRecord);
            newRecord.syncStatus = syncResult.status;
            if (syncResult.error) {
              newRecord.syncError = syncResult.error;
            }

            attendance.unshift(newRecord); // Add to the top of logs
            writeAttendance(attendance);

            return res.json({
              success: true,
              recognized: true,
              employee: {
                id: matchedEmp.id,
                name: matchedEmp.name,
                role: matchedEmp.role,
                photo: matchedEmp.photo
              },
              record: newRecord,
              confidence: matchResult.confidence,
              reasoning: matchResult.reasoning
            });
          } else {
            return res.json({
              success: true,
              recognized: false,
              message: `Similitud detectada con ${matchedEmp.name} (${matchResult.confidence}%), pero es insuficiente para confirmar la identidad de forma segura. Intente de nuevo con mejor iluminación.`,
              reasoning: matchResult.reasoning,
              confidence: matchResult.confidence
            });
          }
        }
      }

      res.json({
        success: true,
        recognized: false,
        message: "No se encontró coincidencia biométrica con ningún empleado registrado en el sistema.",
        reasoning: matchResult.reasoning || "Rasgos faciales no coincidentes.",
        confidence: matchResult.confidence || 0
      });

    } catch (err: any) {
      console.error("Error en reconocimiento biométrico:", err);
      res.status(500).json({ error: "Error de servidor en reconocimiento", details: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
