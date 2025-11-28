import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files");
    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const saved = [];
    for (const entry of files) {
      if (!(entry instanceof File)) continue;
      const arrayBuffer = await entry.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const extension = path.extname(entry.name);
      const fileName = `${Date.now()}-${randomUUID()}${extension}`;
      const filePath = path.join(UPLOAD_DIR, fileName);
      await fs.writeFile(filePath, buffer);
      saved.push({
        name: entry.name,
        path: filePath,
        size: buffer.length,
        mimeType: entry.type,
      });
    }

    return NextResponse.json({ files: saved });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}
