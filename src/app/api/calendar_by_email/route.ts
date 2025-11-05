// src/app/api/calendar_by_email/route.ts  (pode renomear para calendar/route.ts)
import { NextRequest } from "next/server";
import { listEventsFromDefaultCalendar } from "../../../lib/googlecalendar";

export async function POST(req: NextRequest) {
  try {
    const events = await listEventsFromDefaultCalendar();

    const tz = process.env.CALENDAR_TZ || "America/Sao_Paulo";
    const fmt = (s?: string|null) => {
      if (!s) return "—";
      try {
        return new Date(s).toLocaleString("pt-BR", { timeZone: tz });
      } catch { return s; }
    };

    if (!events.length) {
      const msg = `### Agenda (Desafio Moveo)\n\nNão encontrei eventos nos próximos 7 dias.`;
      return Response.json({
        context: { live_instructions: msg },
        responses: [{ type: "text", texts: [msg] }],
      });
    }

    const md = [
      `### Agenda (Desafio Moveo)`,
      "",
      ...events.map((e) => {
        const start = e.start?.dateTime || e.start?.date;
        const end   = e.end?.dateTime   || e.end?.date;
        return `- **${e.summary || "Sem título"}**\n  - Início: ${fmt(start)}\n  - Fim: ${fmt(end)}`;
      }),
    ].join("\n");

    return Response.json({
      context: { live_instructions: md },
      responses: [{ type: "text", texts: [md] }],
    });
  } catch (err: any) {
    console.error(err?.response?.data || err);
    const msg = "Não consegui acessar o calendário padrão. Verifique o CALENDAR_ID_DEFAULT e as permissões da service account.";
    return Response.json({
      context: { live_instructions: msg },
      responses: [{ type: "text", texts: [msg] }],
    }, { status: 500 });
  }
}
