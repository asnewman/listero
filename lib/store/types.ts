import type { Folder, List, ListPatch } from "@/lib/types";

export interface ListStore {
  getAll(): Promise<{ lists: List[]; folders: Folder[] }>;
  create(list: List): Promise<void>;
  update(id: string, patch: ListPatch): Promise<void>;
  remove(id: string): Promise<void>;
  moveList(id: string, folderId: string | null): Promise<void>;
  createFolder(folder: Folder): Promise<void>;
  moveFolder(id: string, parentId: string | null): Promise<void>;
  removeFolder(id: string): Promise<void>;
}
