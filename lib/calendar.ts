import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { AssistantEventInput } from "./assistant/types";
import { getCalendarClient } from "./google";

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TZ = "America/New_York";

export interface ListedCalendarEvent {
  id?: string;
  title: string;
  start_time: string;
  end_time: string;
}

export async function createEvents(events: AssistantEventInput[]): Promise<number> {
  if (!Array.isArray(events) || events.length === 0) return 0;
  const calendar = await getCalendarClient();
  console.log("[calendar] createEvents input:", events);
  let createdCount = 0;

  for (const event of events) {
    try {
      const normalized = normalizeEventTimes(event);
      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: event.title,
          description: event.description ?? undefined,
          location: event.location ?? undefined,
          start: {
            dateTime: normalized.start,
            timeZone: normalized.timezone,
          },
          end: {
            dateTime: normalized.end,
            timeZone: normalized.timezone,
          },
        },
      });
      createdCount += 1;
      console.log("[calendar] createEvents result:", {
        event: event.title,
        id: response.data.id,
      });
    } catch (err) {
      console.error("[calendar] Failed to create event", event, err);
      throw err;
    }
  }

  return createdCount;
}

export async function deleteEvents(eventIds: string[]): Promise<number> {
  if (!eventIds.length) return 0;
  const calendar = await getCalendarClient();
  console.log("[calendar] deleteEvents input:", eventIds);
  let deleted = 0;
  for (const id of eventIds) {
    try {
      await calendar.events.delete({
        calendarId: "primary",
        eventId: id,
      });
      deleted += 1;
    } catch (err) {
      console.error("[calendar] Failed to delete event", id, err);
      throw err;
    }
  }
  console.log("[calendar] deleteEvents result:", { deleted });
  return deleted;
}

export async function updateEventTime(input: {
  eventId?: string;
  startIso: string;
  endIso: string;
}): Promise<void> {
  if (!input.eventId) return;
  const calendar = await getCalendarClient();
  await calendar.events.patch({
    calendarId: "primary",
    eventId: input.eventId,
    requestBody: {
      start: { dateTime: input.startIso },
      end: { dateTime: input.endIso },
    },
  });
}

export async function listEventsForRange(
  userId: string | null,
  timeMinIso: string,
  timeMaxIso: string
): Promise<ListedCalendarEvent[]> {
  void userId; // currently unused; the Google client is bound to the authenticated user
  const calendar = await getCalendarClient();
  try {
    const res = await calendar.events.list({
      calendarId: "primary",
      singleEvents: true,
      orderBy: "startTime",
      timeMin: timeMinIso,
      timeMax: timeMaxIso,
    });
    const items = res.data.items ?? [];
    return items
      .map((item) => {
        const start = item.start?.dateTime || item.start?.date;
        const end = item.end?.dateTime || item.end?.date;
        if (!start || !end) return null;
        return {
          id: item.id ?? undefined,
          title: item.summary ?? "(untitled event)",
          start_time: start,
          end_time: end,
        };
      })
      .filter(Boolean) as ListedCalendarEvent[];
  } catch (err) {
    console.error("[calendar] listEventsForRange failed:", err);
    return [];
  }
}

function normalizeEventTimes(event: AssistantEventInput) {
  const tz = DEFAULT_TZ;
  const start = coerceIso(event.startIso, tz);
  const end = coerceIso(event.endIso, tz);
  return { start, end, timezone: tz };
}

function coerceIso(value: string, tz: string) {
  const parsed = dayjs(value);
  if (parsed.isValid()) {
    return parsed.tz(tz).toISOString();
  }
  return dayjs().tz(tz).toISOString();
}
