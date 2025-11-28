import fs from "fs/promises";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export function dataFile(name: string) {
  return path.join(DATA_DIR, name);
}

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    await ensureDir();
    const file = dataFile(name);
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(name: string, value: any): Promise<void> {
  await ensureDir();
  const file = dataFile(name);
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}
