import { ASSISTANT_RULES } from "@/config/assistantRules";

export type RawEventInput = {
  title: string;
  start?: string;
  end?: string;
  date?: string;
  time?: string;
  durationMinutes?: number;
  timezone?: string;
  assumptions?: Record<string, any>;
};

export type NormalizedEvent = {
  title: string;
  start: string;
  end: string;
  timezone: string;
  assumptions: Record<string, any>;
};

const DEFAULT_TZ = ASSISTANT_RULES?.defaultTimeZone || "America/New_York";
const DEFAULT_DURATION_MINUTES = ASSISTANT_RULES?.defaultEventDurationMinutes || 60;

export function normalizeEvent(input: RawEventInput): NormalizedEvent {
  const assumptions: Record<string, any> = {
    ...(input.assumptions || {}),
  };

  const tz = input.timezone || DEFAULT_TZ;

  if (input.start && input.end) {
    return {
      title: input.title,
      start: new Date(input.start).toISOString(),
      end: new Date(input.end).toISOString(),
      timezone: tz,
      assumptions,
    };
  }

  const now = new Date();

  let baseDate: Date;
  if (input.date === "tomorrow") {
    baseDate = new Date(now);
    baseDate.setDate(now.getDate() + 1);
    assumptions.date = "defaultTomorrow";
  } else if (input.date) {
    baseDate = new Date(input.date);
    assumptions.date = "fromDateField";
  } else {
    baseDate = new Date(now);
    assumptions.date = "defaultToday";
  }

  let hours = 19;
  let minutes = 0;

  if (input.time) {
    const timeStr = input.time.trim().toLowerCase();
    const match = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2] ? parseInt(match[2], 10) : 0;
      const meridiem = match[3];
      if (meridiem === "pm" && h < 12) h += 12;
      if (meridiem === "am" && h === 12) h = 0;
      hours = h;
      minutes = m;
      assumptions.time = "parsedTimeString";
    } else {
      assumptions.time = "defaultEvening19_00";
    }
  } else {
    assumptions.time = "defaultEvening19_00";
  }

  baseDate.setHours(hours, minutes, 0, 0);

  const start = baseDate;
  const duration =
    typeof input.durationMinutes === "number" && input.durationMinutes > 0
      ? input.durationMinutes
      : DEFAULT_DURATION_MINUTES;
  const end = new Date(start.getTime() + duration * 60 * 1000);

  assumptions.durationSource = input.durationMinutes ? "provided" : "defaultDurationMinutes";

  return {
    title: input.title,
    start: start.toISOString(),
    end: end.toISOString(),
    timezone: tz,
    assumptions,
  };
}

