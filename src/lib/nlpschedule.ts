// src/lib/nlpSchedule.ts
const WEEKDAYS: Record<string, number> = {
  "domingo": 0,
  "segunda": 1, "segunda-feira": 1,
  "terca": 2, "terça": 2, "terça-feira": 2, "terca-feira": 2,
  "quarta": 3, "quarta-feira": 3,
  "quinta": 4, "quinta-feira": 4,
  "sexta": 5, "sexta-feira": 5,
  "sabado": 6, "sábado": 6,
};

function nextDateForWeekday(target: number, base: Date) {
  const d = new Date(base);
  const diff = (target + 7 - d.getDay()) % 7 || 7; // sempre a PRÓXIMA
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseTimeToken(t: string): { h: number; m: number } | null {
  // "9h", "10h30", "09:30", "9:15"
  const m1 = t.match(/^(\d{1,2})h(?:(\d{2}))?$/i);
  if (m1) return { h: +m1[1], m: +(m1[2] ?? 0) };
  const m2 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m2) return { h: +m2[1], m: +m2[2] };
  return null;
}

export function parseAgendaText(
  textRaw: string,
  tz: string = "America/Sao_Paulo",
  now: Date = new Date()
) {
  // remove acento de forma compatível
  const text = textRaw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // --- Data ---
  let date: Date | null = null;

  // a) dia da semana
  for (const [name, idx] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(text)) {
      date = nextDateForWeekday(idx, now);
      break;
    }
  }

  // b) data dd/mm(/aaaa)
  if (!date) {
    const m = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (m) {
      const d = +m[1], mo = +m[2] - 1, y = m[3] ? +m[3] : now.getFullYear();
      date = new Date(y, mo, d, 0, 0, 0, 0);
    }
  }

  if (!date) date = new Date(now);

  // --- Horário ---
  let startH = 9, startM = 0, endH = 10, endM = 0; // defaults 1h

  // "das 9h as 10h"
  const range = text.match(/\bdas?\s+([0-9h:\.]+)\s+as?\s+([0-9h:\.]+)\b/);
  if (range) {
    const s = parseTimeToken(range[1].replace(".", ":"));
    const e = parseTimeToken(range[2].replace(".", ":"));
    if (s) { startH = s.h; startM = s.m; }
    if (e) { endH = e.h; endM = e.m; }
  } else {
    // "as 9h"
    const single = text.match(/\bas?\s+([0-9h:\.]+)\b/);
    if (single) {
      const s = parseTimeToken(single[1].replace(".", ":"));
      if (s) { startH = s.h; startM = s.m; endH = s.h + 1; endM = s.m; }
    }
  }

  const start = new Date(date);
  start.setHours(startH, startM, 0, 0);
  const end = new Date(date);
  end.setHours(endH, endM, 0, 0);

  const pad = (n: number) => String(n).padStart(2, "0");
  const tzIso = (d: Date) => {
    const off = -d.getTimezoneOffset(); // minutos
    const sign = off >= 0 ? "+" : "-";
    const hh = pad(Math.floor(Math.abs(off) / 60));
    const mm = pad(Math.abs(off) % 60);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${hh}:${mm}`;
  };

  // Título básico a partir do comando
  const titleMatch = text.match(
    /(?:adicionar|marcar|criar|agendar|colocar)\s+(.+?)(?:\s+(?:na|no|em|dia|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado)\b|$)/
  );
  let summary = titleMatch?.[1]?.trim() || textRaw.trim();
  summary = summary.replace(/\s*[,.!?;]+$/g, "");

  return {
    summary,
    startISO: tzIso(start),
    endISO: tzIso(end),
  };
}
