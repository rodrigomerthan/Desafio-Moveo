// src/lib/googlesheets.ts
import { google } from "googleapis";

function getJWT() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL!;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function sheetsClient() {
  const auth = getJWT();
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

// Procura por telefone (compara só dígitos; bate se for igual OU terminar igual)
export async function findUserByPhone(
  spreadsheetId: string,
  sheetName: string,
  phone: string
) {
  const wanted = (phone || "").replace(/\D/g, "");
  const sheets = await sheetsClient();
  const range = `${sheetName}!A1:Z1000`;

  const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = data.values || [];
  if (rows.length === 0) return null;

  const headers = rows[0].map((h) => (h || "").toString().trim());
  const phoneIdx = headers.findIndex((h) => /phone|telefone/i.test(h));
  if (phoneIdx === -1) throw new Error("Coluna 'phone' não encontrada.");

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const current = (row[phoneIdx] || "").toString().replace(/\D/g, "");
    if (!current) continue;
    if (current === wanted || current.endsWith(wanted)) {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => (obj[h] = (row[idx] || "").toString()));
      (obj as any)._rowIndex = i + 1; // 1-based
      return obj;
    }
  }

  return null;
}
