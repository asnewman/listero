import type { List, ListPatch } from "@/lib/types";

export interface ListStore {
  getAll(): Promise<List[]>;
  create(list: List): Promise<void>;
  update(id: string, patch: ListPatch): Promise<void>;
  remove(id: string): Promise<void>;
}
