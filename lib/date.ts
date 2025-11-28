const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTimeLabel(value: string) {
  const parsed = parseDateValue(value);
  if (!parsed) return value;
  if (parsed.allDay) {
    return `${DATE_FORMAT.format(parsed.date)} · All day`;
  }
  return `${DATE_FORMAT.format(parsed.date)} – ${TIME_FORMAT.format(parsed.date)}`;
}

export function formatEventRange(startRaw: string, endRaw: string) {
  const start = parseDateValue(startRaw);
  const end = parseDateValue(endRaw);
  if (!start) {
    return "Not scheduled";
  }

  if (start.allDay && (!end || end.allDay)) {
    return `${DATE_FORMAT.format(start.date)} · All day`;
  }

  if (start && end) {
    const sameDay = start.date.toDateString() === end.date.toDateString();
    if (sameDay) {
      return `${DATE_FORMAT.format(start.date)} — ${TIME_FORMAT.format(
        start.date
      )} to ${TIME_FORMAT.format(end.date)}`;
    }
    return `${DATE_FORMAT.format(start.date)} ${TIME_FORMAT.format(
      start.date
    )} — ${DATE_FORMAT.format(end.date)} ${TIME_FORMAT.format(end.date)}`;
  }

  return `${DATE_FORMAT.format(start.date)} — ${TIME_FORMAT.format(start.date)}`;
}

export function formatDueDate(value: string) {
  const parsed = parseDateValue(value);
  if (!parsed) return value;
  return DATE_FORMAT.format(parsed.date);
}

export function parseDateValue(value: string | undefined | null): {
  date: Date;
  allDay: boolean;
} | null {
  if (!value) return null;
  const allDay = !value.includes("T");
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  return { date, allDay };
}
