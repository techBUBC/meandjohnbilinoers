import { NextResponse } from "next/server";
import { listInboxPage } from "@/lib/google";
import { isSenderBlocked } from "@/lib/emailFilters";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenParam = searchParams.get("pageToken") ?? undefined;
    const sizeParam = Number(searchParams.get("pageSize") ?? "");
    const pageSize = Number.isFinite(sizeParam)
      ? Math.min(Math.max(sizeParam, 5), 25)
      : 15;

    const { messages, nextPageToken } = await listInboxPage({
      pageSize,
      pageToken: tokenParam,
    });
    const filtered = messages.filter((message) => !isSenderBlocked(message.from));

    return NextResponse.json({
      messages: filtered,
      nextPageToken: nextPageToken ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.message ?? "Failed to load Gmail",
        messages: [],
      },
      { status: 500 }
    );
  }
}
