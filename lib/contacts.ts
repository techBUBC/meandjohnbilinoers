import { randomUUID } from "crypto";
import { readJson, writeJson } from "./store";
import { extractEmailAddressFromInbox } from "./google";

export type Contact = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  createdAt: string;
};

const FILE = "contacts.json";

async function loadContacts(): Promise<Contact[]> {
  return readJson<Contact[]>(FILE, []);
}

async function saveContacts(contacts: Contact[]): Promise<void> {
  await writeJson(FILE, contacts);
}

export async function getAllContacts(): Promise<Contact[]> {
  return loadContacts();
}

export async function getContactByName(name: string): Promise<Contact | undefined> {
  const contacts = await loadContacts();
  const lower = name.trim().toLowerCase();
  return contacts.find((contact) => contact.name.trim().toLowerCase() === lower);
}

export async function saveContact(input: {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}): Promise<Contact> {
  const contacts = await loadContacts();
  const existing = contacts.find(
    (contact) => contact.name.trim().toLowerCase() === input.name.trim().toLowerCase()
  );
  if (existing) {
    existing.email = input.email?.trim() || existing.email;
    existing.phone = input.phone?.trim() || existing.phone;
    existing.notes = input.notes ?? existing.notes;
    await saveContacts(contacts);
    return existing;
  }

  const contact: Contact = {
    id: randomUUID(),
    name: input.name.trim(),
    email: input.email?.trim() || "",
    phone: input.phone?.trim(),
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  contacts.push(contact);
  await saveContacts(contacts);
  return contact;
}

export async function updateContact(
  id: string,
  fields: Partial<Omit<Contact, "id" | "createdAt">>
): Promise<Contact | null> {
  const contacts = await loadContacts();
  const index = contacts.findIndex((contact) => contact.id === id);
  if (index === -1) return null;
  contacts[index] = { ...contacts[index], ...fields };
  await saveContacts(contacts);
  return contacts[index];
}

export async function deleteContact(id: string): Promise<boolean> {
  const contacts = await loadContacts();
  const filtered = contacts.filter((contact) => contact.id !== id);
  if (filtered.length === contacts.length) {
    return false;
  }
  await saveContacts(filtered);
  return true;
}

export async function findEmailForName(name: string) {
  const reasoning: string[] = [];
  const trimmed = name.trim();
  if (!trimmed) {
    reasoning.push("No name provided for email resolution.");
    return { email: null, reasoning };
  }

  const contact = await getContactByName(trimmed);
  if (contact?.email) {
    reasoning.push(`Found ${contact.email} in contacts for ${trimmed}.`);
    return { email: contact.email, reasoning };
  }
  reasoning.push(`No saved contact for ${trimmed}.`);

  const inboxEmail = await extractEmailAddressFromInbox(trimmed);
  if (inboxEmail) {
    reasoning.push(`Found ${inboxEmail} in Gmail conversation.`);
    return { email: inboxEmail, reasoning };
  }

  reasoning.push(`Unable to resolve email address for ${trimmed}.`);
  return { email: null, reasoning };
}
