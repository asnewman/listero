import { createFolder, createList, deleteFolder, deleteList, getWorkspace, moveFolder, moveList, updateList } from "@/app/actions";
import type { ListStore } from "./types";

export const remoteStore: ListStore = {
  getAll: () => getWorkspace(),
  create: (list) => createList(list),
  update: (id, patch) => updateList(id, patch),
  remove: (id) => deleteList(id),
  moveList: (id, folderId) => moveList(id, folderId),
  createFolder: (folder) => createFolder(folder),
  moveFolder: (id, parentId) => moveFolder(id, parentId),
  removeFolder: (id) => deleteFolder(id),
};
