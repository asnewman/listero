import { createList, deleteList, getLists, updateList } from "@/app/actions";
import type { ListStore } from "./types";

export const remoteStore: ListStore = {
  getAll: () => getLists(),
  create: (list) => createList(list),
  update: (id, patch) => updateList(id, patch),
  remove: (id) => deleteList(id),
};
