// src/app/api/sheets_by_phone/route.ts
import { NextRequest } from "next/server";
import { findUserByPhone } from "../../../lib/googlesheets";
import { sheetUserToMarkdown } from "../../../lib/markdown";

// Normaliza telefone: pega só dígitos e tenta ficar com o final mais “útil”
function normalizePhone(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return "";
  // Se vier muito grande, fico com os últimos 13 (ex.: 55 + DDD + 9 + 8 dígitos)
  // e depois com os últimos 11 (DDD + 9 + 8) se ainda sobrar muito.
  if (digits.length > 13) return digits.slice(-13);
  if (digits.length > 11) return digits.slice(-11);
  return digits;
}

// Lê o corpo de forma super-tolerante
async function readBody(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch {
    try {
      const raw = await req.text();
      try {
        return JSON.parse(raw);
      } catch {
        return {}; // nada mesmo
      }
    } catch {
      return {};
    }
  }
}

// Tenta achar o phone em vários lugares
function pickPhone(body: any, req: NextRequest): string | undefined {
  const headers = req.headers;
  const url = new URL(req.url);

  // 1) Contexto Moveo (se vier JSON)
  const c = body?.context ?? {};
  const t = body?.trigger ?? {};
  const m = body?.message ?? {};

  const candidates: (string | undefined)[] = [
    c.phone,
    c.user?.phone,
    t.text,
    m.text,

    // 2) Cabeçalhos (permite configurar na Moveo: x-phone: {{phone}})
    headers.get("x-phone") || undefined,
    headers.get("phone") || undefined,

    // 3) Query string ?phone=...
    url.searchParams.get("phone") || undefined,
  ];

  const first = candidates.find(v => typeof v === "string" && v.trim().length > 0);
  return first;
}

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);

    // DEBUG curto (não imprime tudo pra não poluir)
    console.log("📩 Body tem keys:", Object.keys(body || {}));
    console.log("🔎 Header x-phone:", req.headers.get("x-phone"));
    console.log("🔎 Query phone:", new URL(req.url).searchParams.get("phone"));

    const rawPhone = pickPhone(body, req);
    const phone = normalizePhone(rawPhone || "");

    if (!phone) {
      const msg = "Por favor, peça o número de telefone do usuário e salve em `phone`.";
      return Response.json({
        context: { live_instructions: msg },
        responses: [{ type: "text", texts: [msg] }],
      });
    }

    const spreadsheetId = process.env.SPREADSHEET_ID!;
    const sheetName = process.env.SHEET_NAME || "Users";

    const user = await findUserByPhone(spreadsheetId, sheetName, phone);

    if (!user) {
      const msg = `### Perfil do usuário (Google Sheets)\nNão encontrei **${rawPhone}** na planilha.`;
      return Response.json({
        context: { live_instructions: msg },
        responses: [{ type: "text", texts: [msg] }],
      });
    }

    const markdown = sheetUserToMarkdown(user);
    return Response.json({
      context: {
        live_instructions: markdown,
        email: (user as any).email || "",
        name:  (user as any).name  || "",
        phone: rawPhone || "",
      },
      responses: [{ type: "text", texts: [markdown] }],
    });
  } catch (err) {
    console.error("ERRO /sheets_by_phone:", err);
    const msg = "Erro interno ao acessar seus dados. Tente novamente em instantes.";
    return Response.json(
      { context: { live_instructions: msg }, responses: [{ type: "text", texts: [msg] }] },
      { status: 500 }
    );
  }
}
