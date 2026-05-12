import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PersistedSubmission, PersistedSubmissionDB } from "@/lib/submission-types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "submissions.json");

const EMPTY_DB: PersistedSubmissionDB = { version: 1, items: [] };

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(DATA_FILE, "utf-8");
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(EMPTY_DB, null, 2), "utf-8");
  }
}

async function readDB(): Promise<PersistedSubmissionDB> {
  await ensureDataFile();
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as PersistedSubmissionDB;
    if (parsed?.version !== 1 || !Array.isArray(parsed.items)) return { ...EMPTY_DB };
    return parsed;
  } catch {
    return { ...EMPTY_DB };
  }
}

async function writeDB(db: PersistedSubmissionDB) {
  await ensureDataFile();
  await writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
}

export async function listSubmissions(): Promise<PersistedSubmission[]> {
  const db = await readDB();
  return [...db.items].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function getSubmissionById(id: string): Promise<PersistedSubmission | null> {
  const db = await readDB();
  return db.items.find((item) => item.id === id) ?? null;
}

export async function createSubmission(submission: Omit<PersistedSubmission, "id">): Promise<PersistedSubmission> {
  const db = await readDB();
  const created: PersistedSubmission = { ...submission, id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
  db.items.unshift(created);
  await writeDB(db);
  return created;
}

export async function updateSubmission(
  id: string,
  patch: Partial<PersistedSubmission>
): Promise<PersistedSubmission | null> {
  const db = await readDB();
  const idx = db.items.findIndex((item) => item.id === id);
  if (idx < 0) return null;

  const next = {
    ...db.items[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  } as PersistedSubmission;
  db.items[idx] = next;
  await writeDB(db);
  return next;
}

export function createTimelineEvent(event: Omit<PersistedSubmission["timeline"][number], "id" | "at">): PersistedSubmission["timeline"][number] {
  return {
    id: randomUUID(),
    at: new Date().toISOString(),
    ...event,
  };
}

export function createReviewLog(log: Omit<PersistedSubmission["reviewLogs"][number], "id" | "at">): PersistedSubmission["reviewLogs"][number] {
  return {
    id: randomUUID(),
    at: new Date().toISOString(),
    ...log,
  };
}

