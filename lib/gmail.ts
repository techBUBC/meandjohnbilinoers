import { getOpenAI } from "./openai";
import { getMessageDetail, sendEmail as sendGmail, sendReply } from "./google";
import type { AssistantEmailInput } from "./assistant/types";

export async function sendEmail(email: AssistantEmailInput, _fromAddress?: string) {
  if (!email.to || !email.subject || !email.body) {
    throw new Error("Missing email fields");
  }
  const res = await sendGmail({
    to: email.to,
    subject: email.subject,
    body: email.body,
  });
  return res.data.id ?? "email_sent";
}

export async function draftEmailReply(email: AssistantEmailInput, _fromAddress?: string) {
  if (!email.messageId) throw new Error("messageId is required");
  if (!email.instructions) throw new Error("instructions are required");
  const original = await getMessageDetail(email.messageId);
  const recipient = parseRecipient(original);
  const subject = buildReplySubject(original.subject);
  const instruction = email.instructions?.trim() || "Write a helpful reply.";
  const bodyContext =
    original.bodyText ||
    original.bodyHtml ||
    original.snippet ||
    "The original message content is unavailable.";

  const openai = getOpenAI();
  const prompt = `
Compose an email reply.

Original email:
${bodyContext}

User instructions:
${instruction}
`.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You write clear and concise professional email replies." },
      { role: "user", content: prompt },
    ],
  });

  const draftBody = completion.choices[0].message.content?.trim();
  if (!draftBody) {
    throw new Error("Failed to draft reply");
  }

  await sendReply({
    threadId: original.threadId!,
    to: recipient,
    subject,
    body: draftBody,
    references: original.references,
    inReplyTo: original.messageId || original.inReplyTo,
  });
  return draftBody;
}

function buildReplySubject(base?: string) {
  if (!base) return "Re:";
  return base.toLowerCase().startsWith("re:") ? base : `Re: ${base}`;
}

function parseRecipient(original: { replyTo?: string; from: string }) {
  const header = original.replyTo || original.from;
  if (!header) throw new Error("Missing recipient address");
  const match = header.match(/<([^>]+)>/);
  return (match ? match[1] : header).trim();
}
