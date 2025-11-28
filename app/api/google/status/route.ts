import { NextResponse } from "next/server";
import { getStatus } from "@/lib/google";

export async function GET() {
  const status = await getStatus();
  return NextResponse.json(status);
}
