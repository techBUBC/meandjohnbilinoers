import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";

type CleanRequest = {
  text?: string;
};

export async function POST(request: Request) {
  try {
    const body: CleanRequest = await request.json();
    const text = (body.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Fix the provided transcription. Add punctuation, improve casing, remove filler words, and keep the intent intact. Respond with only the cleaned sentence.",
        },
        { role: "user", content: text },
      ],
    });
    const cleaned = completion.choices[0].message.content?.trim() || text;
    return NextResponse.json({ text: cleaned });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to clean transcript" },
      { status: 500 }
    );
  }
}
