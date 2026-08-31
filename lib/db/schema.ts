import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { ListItem } from "@/lib/types";

export const lists = pgTable(
  "lists",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull().default(""),
    items: jsonb("items").$type<ListItem[]>().notNull().default([]),
    folderId: uuid("folder_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lists_user_id_idx").on(t.userId)],
);

export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull().default(""),
    parentId: uuid("parent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("folders_user_id_idx").on(t.userId)],
);
