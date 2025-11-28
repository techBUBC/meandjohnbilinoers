import { NextResponse } from "next/server";
import { getMessageDetail, sendReply } from "@/lib/google";
import { draftEmailReply } from "@/lib/gmail";

type ReplyRequest = {
  emailId?: string;
  threadId?: string;
  body?: string;
  instructions?: string;
  originalMessage?: string;
  mode?: "send_raw" | "ai-draft";
};

export async function POST(request: Request) {
  try {
    const body: ReplyRequest = await request.json();
    if (!body.emailId || !body.threadId) {
      return NextResponse.json(
        { error: "Missing email or thread reference." },
        { status: 400 }
      );
    }

    const original = await getMessageDetail(body.emailId);
    const recipient = parseAddress(original.replyTo || original.from);
    if (!recipient) {
      throw new Error("Could not determine reply recipient.");
    }

    const baseSubject = original.subject || "(no subject)";
    const subject = baseSubject.toLowerCase().startsWith("re:")
      ? baseSubject
      : `Re: ${baseSubject}`;

    const mode = body.mode || "send_raw";
    let finalBody = "";

    if (mode === "send_raw") {
      finalBody = (body.body || "").trim();
      if (!finalBody) {
        return NextResponse.json(
          { error: "Reply body cannot be empty." },
          { status: 400 }
        );
      }
    } else {
      const instructions = (body.instructions || "").trim();
      if (!instructions) {
        return NextResponse.json(
          { error: "Add instructions for the AI drafted reply." },
          { status: 400 }
        );
      }
      await draftEmailReply({
        messageId: body.emailId,
        instructions,
      });
      return NextResponse.json({ status: "ok", mode });
    }

    if (!finalBody) {
      throw new Error("Failed to generate reply body.");
    }

    await sendReply({
      threadId: body.threadId,
      to: recipient,
      subject,
      body: finalBody,
      references: original.references,
      inReplyTo: original.messageId || original.inReplyTo,
    });

    return NextResponse.json({ status: "ok", mode });
  } catch (err: any) {
    console.error("Failed to send Gmail reply", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to send reply" },
      { status: 500 }
    );
  }
}

function parseAddress(header?: string) {
  if (!header) return "";
  const match = header.match(/<([^>]+)>/);
  if (match) return match[1];
  return header;
}
