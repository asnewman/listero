"use server";

import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { isValidDateTag } from "@/lib/date-tags";
import { getDb } from "@/lib/db";
import { folders, lists } from "@/lib/db/schema";
import { MAX_DEPTH, type DateTag, type Folder, type List, type ListItem, type ListPatch } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

function assertId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !UUID.test(id)) throw new Error("Invalid id");
}

function cleanDateTags(value: unknown, text: string): DateTag[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid date tags");
  let previousEnd = 0;
  return value.map((raw) => {
    if (!isValidDateTag(text, raw) || raw.start < previousEnd) throw new Error("Invalid date tag");
    previousEnd = raw.end;
    return { start: raw.start, end: raw.end, date: raw.date };
  });
}

function cleanItems(items: unknown): ListItem[] {
  if (!Array.isArray(items)) throw new Error("Invalid items");
  return items.map((raw) => {
    const it = raw as Partial<ListItem>;
    assertId(it.id);
    if (typeof it.text !== "string") throw new Error("Invalid item text");
    const depth = Number.isInteger(it.depth) ? Math.min(Math.max(it.depth as number, 0), MAX_DEPTH) : 0;
    const dateTags = cleanDateTags(it.dateTags, it.text);
    return dateTags === undefined ? { id: it.id, text: it.text, depth } : { id: it.id, text: it.text, depth, dateTags };
  });
}

function cleanText(text: unknown): string {
  if (typeof text !== "string") throw new Error("Invalid text");
  return text;
}

function cleanFolderId(id: unknown): string | null {
  if (id == null) return null;
  assertId(id);
  return id;
}

async function assertFolderOwned(userId: string, folderId: string | null): Promise<void> {
  if (folderId === null) return;
  const rows = await getDb()
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)));
  if (!rows.length) throw new Error("Invalid folder");
}

function toList(row: typeof lists.$inferSelect): List {
  return {
    id: row.id,
    title: row.title,
    items: row.items,
    folderId: row.folderId,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

function toFolder(row: typeof folders.$inferSelect): Folder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    createdAt: row.createdAt.getTime(),
  };
}

export async function getWorkspace(): Promise<{ lists: List[]; folders: Folder[] }> {
  const userId = await requireUserId();
  const db = getDb();
  // one query set in one action: the client dispatches server actions sequentially
  const [listRows, folderRows] = await Promise.all([
    db.select().from(lists).where(eq(lists.userId, userId)).orderBy(desc(lists.createdAt)),
    db.select().from(folders).where(eq(folders.userId, userId)).orderBy(desc(folders.createdAt)),
  ]);
  return { lists: listRows.map(toList), folders: folderRows.map(toFolder) };
}

export async function createList(list: List): Promise<void> {
  const userId = await requireUserId();
  assertId(list.id);
  const folderId = cleanFolderId(list.folderId);
  await assertFolderOwned(userId, folderId);
  await getDb().insert(lists).values({
    id: list.id,
    userId,
    title: cleanText(list.title),
    items: cleanItems(list.items),
    folderId,
    createdAt: new Date(list.createdAt),
    updatedAt: new Date(list.updatedAt),
  });
}

export async function updateList(id: string, patch: ListPatch): Promise<void> {
  const userId = await requireUserId();
  assertId(id);
  await getDb()
    .update(lists)
    .set({ title: cleanText(patch.title), items: cleanItems(patch.items), updatedAt: new Date(patch.updatedAt) })
    .where(and(eq(lists.id, id), eq(lists.userId, userId)));
}

export async function deleteList(id: string): Promise<void> {
  const userId = await requireUserId();
  assertId(id);
  await getDb().delete(lists).where(and(eq(lists.id, id), eq(lists.userId, userId)));
}

export async function moveList(id: string, folderId: string | null): Promise<void> {
  const userId = await requireUserId();
  assertId(id);
  const target = cleanFolderId(folderId);
  await assertFolderOwned(userId, target);
  await getDb()
    .update(lists)
    .set({ folderId: target })
    .where(and(eq(lists.id, id), eq(lists.userId, userId)));
}

export async function createFolder(folder: Folder): Promise<void> {
  const userId = await requireUserId();
  assertId(folder.id);
  const parentId = cleanFolderId(folder.parentId);
  await assertFolderOwned(userId, parentId);
  await getDb().insert(folders).values({
    id: folder.id,
    userId,
    name: cleanText(folder.name),
    parentId,
    createdAt: new Date(folder.createdAt),
  });
}

export async function moveFolder(id: string, parentId: string | null): Promise<void> {
  const userId = await requireUserId();
  assertId(id);
  const target = cleanFolderId(parentId);
  const rows = await getDb()
    .select({ id: folders.id, parentId: folders.parentId })
    .from(folders)
    .where(eq(folders.userId, userId));
  if (!rows.some((r) => r.id === id)) throw new Error("Invalid id");
  if (target !== null) {
    // the new parent must exist and not sit inside the folder being moved (no cycles)
    const parentOf = new Map(rows.map((r) => [r.id, r.parentId]));
    if (!parentOf.has(target)) throw new Error("Invalid folder");
    for (let cur: string | null = target; cur !== null; cur = parentOf.get(cur) ?? null) {
      if (cur === id) throw new Error("Invalid folder");
    }
  }
  await getDb()
    .update(folders)
    .set({ parentId: target })
    .where(and(eq(folders.id, id), eq(folders.userId, userId)));
}

export async function deleteFolder(id: string): Promise<void> {
  const userId = await requireUserId();
  assertId(id);
  await getDb().transaction(async (tx) => {
    const [target] = await tx.select().from(folders).where(and(eq(folders.id, id), eq(folders.userId, userId)));
    if (!target) return;
    // contents move up to the deleted folder's parent
    await tx
      .update(folders)
      .set({ parentId: target.parentId })
      .where(and(eq(folders.parentId, id), eq(folders.userId, userId)));
    await tx
      .update(lists)
      .set({ folderId: target.parentId })
      .where(and(eq(lists.folderId, id), eq(lists.userId, userId)));
    await tx.delete(folders).where(eq(folders.id, id));
  });
}
