import type { List } from "@/lib/types";
import type { ListStore } from "./types";

const KEY = "listero:lists";

function read(): List[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as List[]) : [];
  } catch {
    return [];
  }
}

function write(lists: List[]) {
  window.localStorage.setItem(KEY, JSON.stringify(lists));
}

export const localStore: ListStore = {
  async getAll() {
    return read();
  },
  async create(list) {
    write([list, ...read()]);
  },
  async update(id, patch) {
    write(read().map((l) => (l.id === id ? { ...l, ...patch } : l)));
  },
  async remove(id) {
    write(read().filter((l) => l.id !== id));
  },
};
