import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google";

export async function GET() {
  try {
    const url = await getAuthUrl();
    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to create Google auth URL" },
      { status: 500 }
    );
  }
}
