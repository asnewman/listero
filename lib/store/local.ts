import type { Folder, List } from "@/lib/types";
import type { ListStore } from "./types";

const LISTS_KEY = "listero:lists";
const FOLDERS_KEY = "listero:folders";

function readLists(): List[] {
  try {
    const raw = window.localStorage.getItem(LISTS_KEY);
    const lists = raw ? (JSON.parse(raw) as List[]) : [];
    // lists saved before folders existed have no folderId
    return lists.map((l) => ({ ...l, folderId: l.folderId ?? null }));
  } catch {
    return [];
  }
}

function readFolders(): Folder[] {
  try {
    const raw = window.localStorage.getItem(FOLDERS_KEY);
    return raw ? (JSON.parse(raw) as Folder[]) : [];
  } catch {
    return [];
  }
}

function writeLists(lists: List[]) {
  window.localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
}

function writeFolders(folders: Folder[]) {
  window.localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

export const localStore: ListStore = {
  async getAll() {
    return { lists: readLists(), folders: readFolders() };
  },
  async create(list) {
    writeLists([list, ...readLists()]);
  },
  async update(id, patch) {
    writeLists(readLists().map((l) => (l.id === id ? { ...l, ...patch } : l)));
  },
  async remove(id) {
    writeLists(readLists().filter((l) => l.id !== id));
  },
  async moveList(id, folderId) {
    writeLists(readLists().map((l) => (l.id === id ? { ...l, folderId } : l)));
  },
  async createFolder(folder) {
    writeFolders([folder, ...readFolders()]);
  },
  async moveFolder(id, parentId) {
    writeFolders(readFolders().map((f) => (f.id === id ? { ...f, parentId } : f)));
  },
  async removeFolder(id) {
    const folders = readFolders();
    const target = folders.find((f) => f.id === id);
    if (!target) return;
    writeFolders(folders.filter((f) => f.id !== id).map((f) => (f.parentId === id ? { ...f, parentId: target.parentId } : f)));
    writeLists(readLists().map((l) => (l.folderId === id ? { ...l, folderId: target.parentId } : l)));
  },
};
