import { listEventsForRange as baseListEventsForRange, deleteEvents, updateEventTime } from "@/lib/calendar";

export type CalendarEvent = {
  id?: string;
  summary?: string | null;
  start_time: string;
  end_time: string;
  location?: string | null;
};

export async function listEventsForRange(opts: {
  timeMinIso: string;
  timeMaxIso: string;
}): Promise<CalendarEvent[]> {
  const events = await baseListEventsForRange(null, opts.timeMinIso, opts.timeMaxIso);
  return events.map((ev) => ({
    id: ev.id,
    summary: (ev as any).title ?? null,
    start_time: ev.start_time,
    end_time: ev.end_time,
    location: (ev as any).location ?? null,
  }));
}

export async function moveEvent(opts: {
  eventId: string;
  newStartIso: string;
  newEndIso: string;
}): Promise<void> {
  await updateEventTime({
    eventId: opts.eventId,
    startIso: opts.newStartIso,
    endIso: opts.newEndIso,
  });
}

export async function deleteEvent(opts: { eventId: string }): Promise<void> {
  await deleteEvents([opts.eventId]);
}
