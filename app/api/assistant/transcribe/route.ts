import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";

const TEMP_DIR = path.join(process.cwd(), "data", "uploads");

export async function POST(request: Request) {
  if (process.env.WHISPER_ENABLED !== "true") {
    return NextResponse.json({ error: "Whisper disabled" }, { status: 403 });
  }

  let tempPath: string | null = null;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    await fs.mkdir(TEMP_DIR, { recursive: true });
    tempPath = path.join(TEMP_DIR, `voice-${Date.now()}.webm`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempPath, buffer);

    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(tempPath),
      model: "gpt-4o-mini-transcribe",
      response_format: "text",
    });

    const text =
      typeof transcription === "string"
        ? transcription
        : (transcription as any).text || "";

    return NextResponse.json({ text: text.trim() });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to transcribe" },
      { status: 500 }
    );
  } finally {
    if (tempPath) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // ignore
      }
    }
  }
}
