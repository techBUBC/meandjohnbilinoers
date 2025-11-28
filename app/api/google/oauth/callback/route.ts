import { NextRequest, NextResponse } from "next/server";
import { handleAuthCode } from "@/lib/google";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const origin = req.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(new URL("/?google=error", origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?google=error", origin));
  }

  try {
    await handleAuthCode(code);
    return NextResponse.redirect(new URL("/?google=connected", origin));
  } catch (err) {
    console.error("Google OAuth callback failure", err);
    return NextResponse.redirect(new URL("/?google=error", origin));
  }
}
