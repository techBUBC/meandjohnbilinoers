import { listEvents } from "./google";

export async function listCalendarEvents() {
  return listEvents();
}

