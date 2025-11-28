import { NextResponse } from "next/server";
import { getMessageDetail } from "@/lib/google";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const message = await getMessageDetail(id);
    return NextResponse.json({ message });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to load email" },
      { status: 500 }
    );
  }
}
