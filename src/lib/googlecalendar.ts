// src/lib/googleCalendar.ts
import { google } from "googleapis";

function getJWT() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL!;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    // se só ler: "calendar.readonly". Se também vai criar/editar: "calendar".
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
}

async function calendarClient() {
  const auth = getJWT();
  await auth.authorize();
  return google.calendar({ version: "v3", auth });
}

export async function listEventsFromDefaultCalendar() {
  const calendar = await calendarClient();
  const calendarId = process.env.CALENDAR_ID_DEFAULT!;
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);

  const { data } = await calendar.events.list({
    calendarId,
    timeMin: now.toISOString(),
    timeMax: nextWeek.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return data.items || [];
}
