import { google, gmail_v1, calendar_v3 } from "googleapis";
import { readJson, writeJson } from "./store";

type StoredTokens = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
};

const TOKEN_FILE = "google-tokens.json";

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function getAuthUrl() {
  const oAuth2Client = getOAuth2Client();
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
  ];

  const url = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  return url;
}

export async function handleAuthCode(code: string) {
  const oAuth2Client = getOAuth2Client();
  const { tokens } = await oAuth2Client.getToken(code);
  await writeJson(TOKEN_FILE, tokens);
  return tokens;
}

async function loadTokens(): Promise<StoredTokens | null> {
  const tokens = await readJson<StoredTokens | null>(TOKEN_FILE, null);
  return tokens;
}

async function getAuthorizedClient() {
  const tokens = await loadTokens();
  if (!tokens) {
    throw new Error("Google not connected yet");
  }
  const client = getOAuth2Client();
  client.setCredentials(tokens);
  return client;
}

export async function getStatus() {
  try {
    const tokens = await loadTokens();
    if (!tokens) {
      return { connected: false };
    }
    const client = await getAuthorizedClient();
    const oauth2 = google.oauth2({ auth: client, version: "v2" });
    const me = await oauth2.userinfo.get();
    return {
      connected: true,
      email: me.data.email || undefined,
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message ?? "Failed to load Google status",
    };
  }
}

export async function getGmailClient() {
  const auth = await getAuthorizedClient();
  return google.gmail({ version: "v1", auth });
}

export async function getCalendarClient() {
  const auth = await getAuthorizedClient();
  return google.calendar({ version: "v3", auth });
}

export async function listEvents() {
  const calendar = await getCalendarClient();
  const now = new Date();
  const timeMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 20,
  });

  const events = res.data.items || [];
  return events.map((ev) => ({
    id: ev.id,
    summary: ev.summary,
    start: ev.start?.dateTime || ev.start?.date || "",
    end: ev.end?.dateTime || ev.end?.date || "",
    location: ev.location || "",
  }));
}

export async function createEvent(input: {
  summary: string;
  start: string;
  end: string;
  description?: string;
  attendees?: string[];
  timeZone?: string;
}): Promise<calendar_v3.Schema$Event | { error: string }> {
  const calendar = await getCalendarClient();
  try {
    const startDate = new Date(input.start);
    const endDate = new Date(input.end);
    if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
      return { error: "Invalid start or end date" };
    }

    const timeZone = input.timeZone || "America/New_York";
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: startDate.toISOString(), timeZone },
        end: { dateTime: endDate.toISOString(), timeZone },
        attendees: input.attendees?.map((email) => ({ email })),
      },
    });
    return res.data;
  } catch (err: any) {
    console.error("Failed to insert calendar event", err);
    return { error: err?.message ?? "Failed to create calendar event" };
  }
}

export async function getEvent(eventId: string) {
  const calendar = await getCalendarClient();
  const res = await calendar.events.get({
    calendarId: "primary",
    eventId,
  });
  const ev = res.data;
  if (!ev.id) {
    throw new Error("Event not found");
  }
  return {
    id: ev.id,
    summary: ev.summary ?? "(no title)",
    description: ev.description ?? "",
    start: ev.start?.dateTime || ev.start?.date || "",
    end: ev.end?.dateTime || ev.end?.date || "",
    location: ev.location || "",
    htmlLink: ev.htmlLink || "",
  };
}

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
  resolvedEmail?: string;
  reasoning?: string[];
};

export type SendEmailResult = {
  data: gmail_v1.Schema$Message;
  reasoning: string[];
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const gmail = await getGmailClient();
  const reasoning = input.reasoning ? [...input.reasoning] : [];
  const recipient = (input.resolvedEmail ?? input.to).trim();
  if (!recipient || !recipient.includes("@")) {
    throw new Error(`Cannot send email without a valid address for "${input.to}".`);
  }
  reasoning.push(`Sending email to ${recipient}`);

  const raw = encodeMessage(
    [`To: ${recipient}`, `Subject: ${input.subject}`, 'Content-Type: text/plain; charset="utf-8"'],
    input.body
  );
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
  return { data: res.data, reasoning };
}

export type GmailMessageSummary = {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  to?: string;
  snippet: string;
  date: string;
};

export type GmailMessageDetail = GmailMessageSummary & {
  bodyHtml?: string;
  bodyText?: string;
  references?: string;
  inReplyTo?: string;
  messageId?: string;
  replyTo?: string;
};

export async function listInboxPage(params: { pageSize?: number; pageToken?: string }) {
  const gmail = await getGmailClient();
  const { pageSize = 15, pageToken } = params;
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: pageSize,
    pageToken,
    labelIds: ["INBOX"],
  });

  const summaries = await Promise.all(
    (list.data.messages ?? []).map(async (msg) => {
      if (!msg.id) return null;
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "To", "Date"],
      });
      if (!full.data.id) return null;
      return mapMessageSummary(full.data);
    })
  );

  return {
    messages: summaries.filter(Boolean) as GmailMessageSummary[],
    nextPageToken: list.data.nextPageToken ?? undefined,
  };
}

export async function extractEmailAddressFromInbox(name: string): Promise<string | null> {
  const target = name.trim().toLowerCase();
  if (!target) return null;
  try {
    const { messages } = await listInboxPage({ pageSize: 50 });
    for (const message of messages) {
      const candidate =
        extractEmailFromHeader(message.from, target) ||
        extractEmailFromHeader(message.to ?? "", target);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  } catch (err) {
    console.warn("Failed to search Gmail for contact", err);
    return null;
  }
}

export async function getMessageDetail(id: string): Promise<GmailMessageDetail> {
  const gmail = await getGmailClient();
  const full = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });
  if (!full.data.id) {
    throw new Error("Message not found");
  }
  const summary = mapMessageSummary(full.data);
  const headers = full.data.payload?.headers ?? [];
  const { html, text } = extractBody(full.data.payload);
  return {
    ...summary,
    bodyHtml: html,
    bodyText: text,
    references: getHeader(headers, "References") ?? undefined,
    inReplyTo: getHeader(headers, "In-Reply-To") ?? undefined,
    messageId: getHeader(headers, "Message-ID") ?? undefined,
    replyTo: getHeader(headers, "Reply-To") ?? undefined,
  };
}

export async function sendReply(input: {
  threadId: string;
  to: string;
  subject: string;
  body: string;
  references?: string;
  inReplyTo?: string;
}) {
  const gmail = await getGmailClient();
  const headers = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'Content-Type: text/plain; charset="utf-8"',
  ];
  if (input.inReplyTo) headers.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references) headers.push(`References: ${input.references}`);

  const raw = encodeMessage(headers, input.body);
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: input.threadId,
    },
  });
  return res.data;
}

function mapMessageSummary(message: gmail_v1.Schema$Message): GmailMessageSummary {
  const headers = message.payload?.headers ?? [];
  const subject = getHeader(headers, "Subject") ?? "(no subject)";
  const from = getHeader(headers, "From") ?? "Unknown sender";
  const to = getHeader(headers, "To") ?? "";
  const date = normalizeDate(getHeader(headers, "Date"), message.internalDate);
  return {
    id: message.id!,
    threadId: message.threadId ?? undefined,
    subject,
    from,
    to,
    snippet: message.snippet ?? "",
    date,
  };
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string | null {
  if (!headers) return null;
  const found = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return found?.value ?? null;
}

function normalizeDate(headerDate: string | null, internalDate?: string | null) {
  if (headerDate) {
    const parsed = new Date(headerDate);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  }
  if (internalDate) {
    const ms = Number(internalDate);
    if (!Number.isNaN(ms)) {
      return new Date(ms).toISOString();
    }
  }
  return new Date().toISOString();
}

function decodeBody(data?: string | null) {
  if (!data) return "";
  const buff = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  return buff.toString("utf8");
}

function extractBody(payload?: gmail_v1.Schema$MessagePart): {
  html?: string;
  text?: string;
} {
  if (!payload) return {};
  const mimeType = payload.mimeType || "";
  const bodyData = payload.body?.data;
  let html: string | undefined;
  let text: string | undefined;

  if (mimeType.includes("text/html") && bodyData) {
    html = decodeBody(bodyData);
  } else if (mimeType.includes("text/plain") && bodyData) {
    text = decodeBody(bodyData);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (!part) continue;
      const child = extractBody(part);
      if (!html && child.html) html = child.html;
      if (!text && child.text) text = child.text;
      if (html && text) break;
    }
  }

  return { html, text };
}

function encodeMessage(headers: string[], body: string) {
  const messageLines = [...headers, "", body];
  return Buffer.from(messageLines.join("\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function extractEmailFromHeader(header: string, targetName: string) {
  if (!header) return null;
  const lowerHeader = header.toLowerCase();
  if (!lowerHeader.includes(targetName)) return null;
  const match = header.match(/<([^>]+)>/);
  if (match) return match[1];
  const emailMatch = header.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return emailMatch ? emailMatch[0] : null;
}
