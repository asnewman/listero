"use server";

import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { lists } from "@/lib/db/schema";
import { MAX_DEPTH, type List, type ListItem, type ListPatch } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

function assertId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !UUID.test(id)) throw new Error("Invalid id");
}

function cleanItems(items: unknown): ListItem[] {
  if (!Array.isArray(items)) throw new Error("Invalid items");
  return items.map((raw) => {
    const it = raw as Partial<ListItem>;
    assertId(it.id);
    if (typeof it.text !== "string") throw new Error("Invalid item text");
    const depth = Number.isInteger(it.depth) ? Math.min(Math.max(it.depth as number, 0), MAX_DEPTH) : 0;
    return { id: it.id, text: it.text, depth };
  });
}

function cleanTitle(title: unknown): string {
  if (typeof title !== "string") throw new Error("Invalid title");
  return title;
}

function toList(row: typeof lists.$inferSelect): List {
  return {
    id: row.id,
    title: row.title,
    items: row.items,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function getLists(): Promise<List[]> {
  const userId = await requireUserId();
  const rows = await getDb().select().from(lists).where(eq(lists.userId, userId)).orderBy(desc(lists.createdAt));
  return rows.map(toList);
}

export async function createList(list: List): Promise<void> {
  const userId = await requireUserId();
  assertId(list.id);
  await getDb().insert(lists).values({
    id: list.id,
    userId,
    title: cleanTitle(list.title),
    items: cleanItems(list.items),
    createdAt: new Date(list.createdAt),
    updatedAt: new Date(list.updatedAt),
  });
}

export async function updateList(id: string, patch: ListPatch): Promise<void> {
  const userId = await requireUserId();
  assertId(id);
  await getDb()
    .update(lists)
    .set({ title: cleanTitle(patch.title), items: cleanItems(patch.items), updatedAt: new Date(patch.updatedAt) })
    .where(and(eq(lists.id, id), eq(lists.userId, userId)));
}

export async function deleteList(id: string): Promise<void> {
  const userId = await requireUserId();
  assertId(id);
  await getDb().delete(lists).where(and(eq(lists.id, id), eq(lists.userId, userId)));
}
