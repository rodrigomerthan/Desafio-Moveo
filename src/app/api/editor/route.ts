// src/app/api/editor/route.ts
import { NextRequest } from "next/server";
import { google } from "googleapis";
import { findUserByPhone } from "../../../lib/googlesheets";
import { parseAgendaText } from "../../../lib/nlpschedule";

/** --------------------- Helpers genéricos --------------------- */

function normalizePhone(p: string) {
  return (p || "").replace(/\D/g, "").slice(-11);
}

async function readBody(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch {
    const raw = await req.text();
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}

/** Tenta pegar variável do body.context, body direto, headers x-*, header normal ou query */
function pickVar(name: string, body: any, req: NextRequest): string {
  const ctx = body?.context ?? {};
  const h = req.headers;
  const url = new URL(req.url);

  return (
    ctx[name] ??
    body?.[name] ??
    h.get(`x-${name}`) ??
    h.get(name) ??
    url.searchParams.get(name) ??
    ""
  ).toString();
}

function getJWT() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL!,
    key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/calendar",
    ],
  });
}

async function sheetsClient() {
  const auth = getJWT();
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

// Converte índice de coluna (0=A) para A1 (A,B,...,AA)
function colIndexToA1(idx: number) {
  let s = "";
  let n = idx + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Atualiza colunas por nome (ex.: { name: "Novo", email: "novo@..." }) para a linha localizada pelo phone */
async function updateByPhone(
  spreadsheetId: string,
  sheetName: string,
  phone: string,
  updates: Record<string, string>
) {
  const sheets = await sheetsClient();

  // 1) Lê planilha toda (A..Z) — simples e robusto
  const range = `${sheetName}!A1:Z1000`;
  const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = data.values || [];
  if (rows.length === 0) throw new Error("Planilha vazia.");

  // 2) Cabeçalho e índices
  const headers = rows[0].map((h) => (h || "").toString().trim());
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const phoneIdx = lowerHeaders.findIndex((h) => /phone|telefone/.test(h));
  if (phoneIdx === -1) throw new Error("Coluna 'phone' não encontrada.");

  // 3) Localiza linha via phone (dígitos)
  const wanted = normalizePhone(phone);
  let target = -1;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const current = (row[phoneIdx] || "").toString().replace(/\D/g, "");
    if (current === wanted || current.endsWith(wanted)) {
      target = i; // 0-based (0 = header)
      break;
    }
  }
  if (target === -1) throw new Error("Telefone não encontrado.");

  // 4) Aplica updates pelo nome da coluna (case-insensitive)
  const row = rows[target] || [];
  Object.entries(updates).forEach(([key, value]) => {
    const col = lowerHeaders.indexOf(key.toLowerCase());
    if (col >= 0) row[col] = value;
  });

  // 5) Escreve a linha inteira de volta
  const lastCol = colIndexToA1(headers.length - 1);
  const a1Row = target + 1; // header = 1, dados começam em 2
  const writeRange = `${sheetName}!A${a1Row}:${lastCol}${a1Row}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: writeRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  return { row: a1Row };
}

/** ----------------------- Handler principal ----------------------- */

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);

    // Variáveis tolerantes (lê de vários lugares)
    const acao = pickVar("acao", body, req).toLowerCase();               // "nome" | "email" | "evento"
    const phone = normalizePhone(pickVar("phone", body, req));
    const novoNome = pickVar("novo_nome", body, req);
    const novoEmail = pickVar("novo_email", body, req);
    const instrucaoAgenda = pickVar("instrucao_agenda", body, req);
    const emailRef = pickVar("email", body, req); // pode ter vindo do webhook anterior

    // Env
    const spreadsheetId = process.env.SPREADSHEET_ID!;
    const sheetName = process.env.SHEET_NAME || "Users";
    const calendarId = process.env.CALENDAR_ID_DEFAULT!;

    // --- Atualizar Nome ---
    if (acao === "nome") {
      if (!phone) {
        const msg = "Antes de editar o nome, informe seu telefone.";
        return Response.json({ context: { live_instructions: msg }, responses: [{ type: "text", texts: [msg] }] });
      }
      if (!novoNome) {
        const msg = "Qual é o novo nome?";
        return Response.json({ context: { live_instructions: msg }, responses: [{ type: "text", texts: [msg] }] });
      }

      // Garante que o telefone existe
      const found = await findUserByPhone(spreadsheetId, sheetName, phone);
      if (!found) {
        const msg = "Telefone não encontrado na planilha.";
        return Response.json({ context: { live_instructions: msg }, responses: [{ type: "text", texts: [msg] }] });
      }

      await updateByPhone(spreadsheetId, sheetName, phone, { name: novoNome });
      const ok = `✅ Nome atualizado para **${novoNome}**.`;
      return Response.json({
        context: { live_instructions: ok, name: novoNome },
        responses: [{ type: "text", texts: [ok] }],
      });
    }

    // --- Atualizar Email ---
    if (acao === "email") {
      if (!phone) {
        const msg = "Antes de editar o e-mail, informe seu telefone.";
        return Response.json({ context: { live_instructions: msg }, responses: [{ type: "text", texts: [msg] }] });
      }
      if (!novoEmail) {
        const msg = "Qual é o novo e-mail?";
        return Response.json({ context: { live_instructions: msg }, responses: [{ type: "text", texts: [msg] }] });
      }

      const found = await findUserByPhone(spreadsheetId, sheetName, phone);
      if (!found) {
        const msg = "Telefone não encontrado na planilha.";
        return Response.json({ context: { live_instructions: msg }, responses: [{ type: "text", texts: [msg] }] });
      }

      await updateByPhone(spreadsheetId, sheetName, phone, { email: novoEmail });
      const ok = `✅ E-mail atualizado para **${novoEmail}**.`;
      return Response.json({
        context: { live_instructions: ok, email: novoEmail },
        responses: [{ type: "text", texts: [ok] }],
      });
    }

    // --- Criar Evento no Calendar ---
    if (acao === "evento" || acao === "agenda" || acao === "calendar") {
      if (!instrucaoAgenda) {
        const msg = "Me diga o que deseja no calendário (ex.: 'consulta na sexta das 9h às 10h').";
        return Response.json({ context: { live_instructions: msg }, responses: [{ type: "text", texts: [msg] }] });
      }

      const auth = getJWT(); await auth.authorize();
      const calendar = google.calendar({ version: "v3", auth });

      const { summary, startISO, endISO } = parseAgendaText(instrucaoAgenda, "America/Sao_Paulo");

      await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: summary || "Novo compromisso",
          description: instrucaoAgenda + (emailRef ? `\n(Referência: ${emailRef})` : ""),
          start: { dateTime: startISO, timeZone: "America/Sao_Paulo" },
          end:   { dateTime: endISO,   timeZone: "America/Sao_Paulo" },
        },
      });

      const ok = `✅ Evento criado!\n\n**Resumo:** ${summary || "Novo compromisso"}\n**Obs.:** ${instrucaoAgenda}`;
      return Response.json({ context: { live_instructions: ok }, responses: [{ type: "text", texts: [ok] }] });
    }

    // Fallback
    const msg = "Diga se quer alterar **nome**, **email** ou **criar evento**.";
    return Response.json({ context: { live_instructions: msg }, responses: [{ type: "text", texts: [msg] }] });

  } catch (err) {
    console.error("ERRO NO WEBHOOK /editor:", err);
    const msg = "Ops! Tive um erro ao processar sua solicitação.";
    return Response.json({ context: { live_instructions: msg }, responses: [{ type: "text", texts: [msg] }] }, { status: 500 });
  }
}
