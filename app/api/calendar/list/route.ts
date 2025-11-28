import { NextResponse } from "next/server";
import { listEvents } from "@/lib/google";

export async function GET() {
  try {
    const events = await listEvents();
    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to load calendar", events: [] },
      { status: 500 }
    );
  }
}
