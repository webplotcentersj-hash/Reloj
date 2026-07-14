import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Unlock kiosk — función liviana (no importa Gemini/Express).
 * PIN desde env ADMIN_PIN (default 1234).
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ unlocked: false, error: "Método no permitido" });
    return;
  }

  const expected = String(process.env.ADMIN_PIN || "1234").trim();
  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const pin = String(body.pin ?? "").trim();

  if (!pin) {
    res.status(400).json({ unlocked: false, error: "Ingresá el código" });
    return;
  }

  if (pin === expected) {
    res.status(200).json({ unlocked: true });
    return;
  }

  res.status(401).json({ unlocked: false, error: "Código incorrecto" });
}

function safeParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
