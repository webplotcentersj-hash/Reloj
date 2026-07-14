import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bwdtrzcdzbzrtykjzber.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";
const DEVICE_ID = process.env.DEVICE_ID || "plotlab-reloj-facial-1";
const PHOTO_CACHE_TTL_MS = 8 * 60 * 1000;
const CONFIDENCE_THRESHOLD = 60;

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "plotlab-reloj-data")
  : path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

let memorySettings = {
  deviceName: process.env.DEVICE_NAME || "plotLAB Reloj Facial 1",
  deviceId: DEVICE_ID,
};

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(memorySettings, null, 2));
  }
} catch {
  // Vercel / filesystem read-only: usamos settings en memoria + env
}

type RrhhEmployeeRow = {
  id_usuario: number;
  nombre: string;
  apellido: string;
  sector: string;
  foto_url: string | null;
  login: string;
  entrada_hoy: string | null;
  salida_hoy: string | null;
  tiene_foto_legajo: boolean;
};

type CachedEmployee = {
  id: string;
  idUsuario: number;
  name: string;
  role: string;
  login: string;
  photoUrl: string;
  photoDataUrl: string;
  entradaHoy: string | null;
  salidaHoy: string | null;
  tieneFoto: boolean;
  createdAt: string;
};

type EmployeeCache = {
  fetchedAt: number;
  all: CachedEmployee[];
  withPhoto: CachedEmployee[];
};

let employeeCache: EmployeeCache | null = null;

function getSupabase(): SupabaseClient {
  if (!SUPABASE_KEY) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY en .env"
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readSettings() {
  try {
    const fromFile = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    memorySettings = { ...memorySettings, ...fromFile };
    return { ...memorySettings };
  } catch {
    return { ...memorySettings };
  }
}

function writeSettings(settings: any) {
  memorySettings = {
    deviceName: settings.deviceName || memorySettings.deviceName,
    deviceId: settings.deviceId || memorySettings.deviceId,
  };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(memorySettings, null, 2), "utf-8");
  } catch {
    // ok en Vercel
  }
}

function parseDataUrl(dataUrl: string) {
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return { mimeType: "image/jpeg", data: dataUrl };
  }
  return { mimeType: matches[1], data: matches[2] };
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.error("Error descargando foto:", url, err);
    return null;
  }
}

async function fetchEmployeesFromRrhh(force = false): Promise<EmployeeCache> {
  if (
    !force &&
    employeeCache &&
    Date.now() - employeeCache.fetchedAt < PHOTO_CACHE_TTL_MS
  ) {
    return employeeCache;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("listar_empleados_reloj_tablet");
  if (error) {
    throw new Error(`RPC listar_empleados_reloj_tablet: ${error.message}`);
  }

  const rows = (data || []) as RrhhEmployeeRow[];
  const all: CachedEmployee[] = [];

  for (const row of rows) {
    const name = `${(row.nombre || "").trim()} ${(row.apellido || "").trim()}`.trim() || row.login;
    const tieneFoto = Boolean(row.tiene_foto_legajo && row.foto_url);
    let photoDataUrl = "";

    if (tieneFoto && row.foto_url) {
      const cached = employeeCache?.all.find(
        (e) => e.idUsuario === row.id_usuario && e.photoUrl === row.foto_url
      );
      if (cached?.photoDataUrl) {
        photoDataUrl = cached.photoDataUrl;
      } else {
        photoDataUrl = (await urlToDataUrl(row.foto_url)) || "";
      }
    }

    all.push({
      id: String(row.id_usuario),
      idUsuario: row.id_usuario,
      name,
      role: row.sector || "Empleado",
      login: row.login,
      photoUrl: row.foto_url || "",
      photoDataUrl,
      entradaHoy: row.entrada_hoy,
      salidaHoy: row.salida_hoy,
      tieneFoto: Boolean(photoDataUrl),
      createdAt: new Date().toISOString(),
    });
  }

  employeeCache = {
    fetchedAt: Date.now(),
    all,
    withPhoto: all.filter((e) => e.tieneFoto && e.photoDataUrl),
  };

  return employeeCache;
}

function toClientEmployee(e: CachedEmployee) {
  return {
    id: e.id,
    name: e.name,
    role: e.role,
    photo: e.photoDataUrl || e.photoUrl,
    login: e.login,
    entradaHoy: e.entradaHoy,
    salidaHoy: e.salidaHoy,
    tieneFoto: e.tieneFoto,
    createdAt: e.createdAt,
  };
}

/** App Express solo API — usada por Vercel serverless y por el server local. */
export function createApiApp() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      supabaseConfigured: Boolean(SUPABASE_KEY),
      deviceId: DEVICE_ID,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.get("/api/settings", (_req, res) => {
    try {
      const settings = readSettings();
      res.json({
        ...settings,
        deviceId: settings.deviceId || DEVICE_ID,
        supabaseConfigured: Boolean(SUPABASE_KEY),
      });
    } catch (err: any) {
      res.status(500).json({ error: "Error al leer configuraciones", details: err.message });
    }
  });

  app.post("/api/settings", (req, res) => {
    try {
      const { deviceName, deviceId } = req.body;
      const settings = {
        deviceName: deviceName || "plotLAB Reloj Facial 1",
        deviceId: deviceId || DEVICE_ID,
      };
      writeSettings(settings);
      res.json({ message: "Configuración guardada", settings });
    } catch (err: any) {
      res.status(500).json({ error: "Error al guardar configuraciones", details: err.message });
    }
  });

  // Empleados desde RRHH (legajos). Query ?all=1 incluye sin foto.
  app.get("/api/employees", async (req, res) => {
    try {
      const force = req.query.refresh === "1";
      const includeAll = req.query.all === "1";
      const cache = await fetchEmployeesFromRrhh(force);
      const list = includeAll ? cache.all : cache.withPhoto;
      res.json(list.map(toClientEmployee));
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        error: "Error al leer empleados desde plotLAB RRHH",
        details: err.message,
      });
    }
  });

  app.post("/api/employees", (_req, res) => {
    res.status(405).json({
      error:
        "Alta biométrica local deshabilitada. Cargue la foto en el legajo RRHH de plotLAB.",
    });
  });

  app.delete("/api/employees/:id", (_req, res) => {
    res.status(405).json({
      error:
        "Baja biométrica local deshabilitada. Gestione legajos en plotLAB RRHH.",
    });
  });

  // Marcaciones recientes desde RRHH
  app.get("/api/attendance", async (req, res) => {
    try {
      const supabase = getSupabase();
      const today = new Date();
      const desde =
        (req.query.desde as string) ||
        new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const hasta =
        (req.query.hasta as string) || today.toISOString().slice(0, 10);

      const { data, error } = await supabase.rpc("listar_marcaciones_tablet_rango", {
        p_desde: desde,
        p_hasta: hasta,
      });

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data || []) as any[];
      const records = rows.map((r) => ({
        id: String(r.id ?? `${r.id_usuario}-${r.marcado_at}`),
        employeeId: String(r.id_usuario),
        employeeName:
          r.empleado ||
          r.nombre_completo ||
          `${r.nombre || ""} ${r.apellido || ""}`.trim() ||
          r.login ||
          String(r.id_usuario),
        timestamp: r.marcado_at,
        type: r.tipo === "salida" ? "salida" : "entrada",
        capturedPhoto: r.foto_url || r.legajo_foto_url || "",
        confidence: Number(r.verificacion_confianza ?? 0),
        syncStatus: "sincronizado" as const,
        syncError: "",
        reasoning: r.verificacion_detalle || "",
        dispositivoId: r.dispositivo_id || "",
      }));

      res.json(records);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Error al leer marcaciones RRHH", details: err.message });
    }
  });

  app.post("/api/attendance/recognize", async (req, res) => {
    try {
      const { photo, type } = req.body;
      if (!photo || !type || (type !== "entrada" && type !== "salida")) {
        return res.status(400).json({
          error: "La foto y el tipo ('entrada' o 'salida') son obligatorios.",
        });
      }

      if (!SUPABASE_KEY) {
        return res.status(503).json({
          error:
            "Supabase no configurado. Defina SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY en .env",
        });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          error: "GEMINI_API_KEY no configurada en el entorno.",
        });
      }

      const cache = await fetchEmployeesFromRrhh(false);
      const employees = cache.withPhoto;

      if (employees.length === 0) {
        return res.status(400).json({
          error:
            "No hay empleados con foto de legajo en plotLAB RRHH. Cargue fotos faciales en los legajos.",
        });
      }

      const { mimeType: capturedMime, data: capturedData } = parseDataUrl(photo);
      const contentsParts: any[] = [];

      contentsParts.push({
        text: `Eres un sistema biométrico de reconocimiento facial de alta precisión en español.
Tu tarea es identificar a la persona en la 'Foto Capturada' comparándola con las 'Fotos de Referencia' de los empleados registrados.

Reglas críticas de comparación:
1. Analiza cuidadosamente la geometría facial, estructura de los ojos, nariz, boca, forma de la cara, cejas y mandíbula.
2. Ignora diferencias en iluminación, fondo, calidad de la cámara, expresión (sonreír o serio), peinado o uso de lentes cotidianos.
3. Si la persona de la 'Foto Capturada' es la misma que uno de los empleados de referencia, identifícalo indicando su ID exacto (número de usuario) y un porcentaje de confianza realista (0-100%).
4. Si NO coincide claramente con nadie, o la confianza es extremadamente baja, marca 'matched' como false, 'employeeId' como null y confianza baja.
5. Brinda un análisis técnico, objetivo y breve de los rasgos en 'reasoning' en idioma español.`,
      });

      contentsParts.push({
        text: `--- FOTO CAPTURADA ---
Esta es la persona que está intentando registrar su ${type} en el reloj biométrico plotLAB.`,
      });
      contentsParts.push({
        inlineData: { mimeType: capturedMime, data: capturedData },
      });

      contentsParts.push({
        text: `--- FOTOS DE REFERENCIA DE EMPLEADOS (RRHH) ---
Compara la 'Foto Capturada' anterior con cada una de estas fotos de referencia. El ID es el id_usuario numérico:`,
      });

      for (const emp of employees) {
        const { mimeType: refMime, data: refData } = parseDataUrl(emp.photoDataUrl);
        contentsParts.push({
          text: `Empleado ID: "${emp.id}", Nombre Completo: "${emp.name}", Sector: "${emp.role}"`,
        });
        contentsParts.push({
          inlineData: { mimeType: refMime, data: refData },
        });
      }

      contentsParts.push({
        text: `Realiza la comparación y devuelve la respuesta en formato JSON estructurado. employeeId debe ser el ID numérico exacto del empleado (ej. "56").`,
      });

      const geminiResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contentsParts,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matched: {
                type: Type.BOOLEAN,
                description:
                  "True si el rostro de la captura coincide con alguno de los empleados registrados.",
              },
              employeeId: {
                type: Type.STRING,
                description:
                  "El id_usuario numérico que coincide (ej. '56'). Nulo si matched es false.",
              },
              confidence: {
                type: Type.INTEGER,
                description:
                  "Entero 0-100 de confianza de similitud facial.",
              },
              reasoning: {
                type: Type.STRING,
                description:
                  "Explicación técnica en español de por qué coincide o no.",
              },
            },
            required: ["matched", "employeeId", "confidence", "reasoning"],
          },
        },
      });

      const resultText = geminiResponse.text?.trim() || "{}";
      const matchResult = JSON.parse(resultText);

      if (matchResult.matched && matchResult.employeeId != null) {
        const empId = String(matchResult.employeeId);
        const matchedEmp =
          employees.find((e) => e.id === empId) ||
          employees.find((e) => e.idUsuario === Number(empId));

        if (matchedEmp) {
          if (matchResult.confidence >= CONFIDENCE_THRESHOLD) {
            const settings = readSettings();
            const dispositivo =
              settings.deviceId || DEVICE_ID;

            const supabase = getSupabase();
            const { data: rpcData, error: rpcError } = await supabase.rpc(
              "registrar_marcacion_tablet",
              {
                p_id_usuario: matchedEmp.idUsuario,
                p_tipo: type,
                p_hora: new Date().toISOString(),
                p_foto_url: null,
                p_confianza: matchResult.confidence,
                p_detalle: matchResult.reasoning || null,
                p_dispositivo: dispositivo,
              }
            );

            if (rpcError) {
              return res.json({
                success: false,
                recognized: true,
                message: rpcError.message,
                employee: {
                  id: matchedEmp.id,
                  name: matchedEmp.name,
                  role: matchedEmp.role,
                  photo: matchedEmp.photoDataUrl || matchedEmp.photoUrl,
                },
                confidence: matchResult.confidence,
                reasoning: matchResult.reasoning,
              });
            }

            const rpc = rpcData as any;
            employeeCache = null;

            return res.json({
              success: true,
              recognized: true,
              employee: {
                id: matchedEmp.id,
                name: matchedEmp.name,
                role: matchedEmp.role,
                photo: matchedEmp.photoDataUrl || matchedEmp.photoUrl,
              },
              record: {
                id: `RRHH-${matchedEmp.idUsuario}-${Date.now()}`,
                employeeId: matchedEmp.id,
                employeeName: matchedEmp.name,
                timestamp: rpc?.hora || new Date().toISOString(),
                type: rpc?.tipo || type,
                capturedPhoto: "",
                confidence: matchResult.confidence,
                syncStatus: "sincronizado",
                reasoning: matchResult.reasoning,
              },
              confidence: matchResult.confidence,
              reasoning: matchResult.reasoning,
              rrhh: rpc,
              message: rpc?.mensaje || "Marcación registrada en plotLAB RRHH",
            });
          }

          return res.json({
            success: true,
            recognized: false,
            message: `Similitud con ${matchedEmp.name} (${matchResult.confidence}%), insuficiente. Mejorá la iluminación.`,
            reasoning: matchResult.reasoning,
            confidence: matchResult.confidence,
          });
        }
      }

      res.json({
        success: true,
        recognized: false,
        message:
          "No se encontró coincidencia biométrica con ningún empleado de plotLAB RRHH.",
        reasoning: matchResult.reasoning || "Rasgos faciales no coincidentes.",
        confidence: matchResult.confidence || 0,
      });
    } catch (err: any) {
      console.error("Error en reconocimiento biométrico:", err);
      res.status(500).json({
        error: "Error de servidor en reconocimiento",
        details: err.message,
      });
    }
  });

  return app;
}

async function startLocalServer() {
  const app = createApiApp();
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`plotLAB Reloj Facial on port ${PORT}`);
    console.log(
      SUPABASE_KEY
        ? `Supabase OK (${SUPABASE_URL})`
        : "WARN: falta SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY en .env"
    );
  });
}

// Solo escucha en local / Node tradicional (no en Vercel serverless)
if (!process.env.VERCEL) {
  startLocalServer();
}
