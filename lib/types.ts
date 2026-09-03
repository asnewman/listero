export type DateTag = {
  start: number;
  end: number;
  date: string;
};

export type ListItem = {
  id: string;
  text: string;
  depth: number;
  dateTags?: DateTag[];
};

export type List = {
  id: string;
  title: string;
  items: ListItem[];
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
};

export type ListPatch = {
  title: string;
  items: ListItem[];
  updatedAt: number;
};

export const MAX_DEPTH = 8;

export function newId(): string {
  return crypto.randomUUID();
}

export function newItem(depth = 0, text = ""): ListItem {
  return { id: newId(), text, depth, dateTags: [] };
}

export function newList(folderId: string | null = null): List {
  const now = Date.now();
  return { id: newId(), title: "", items: [newItem()], folderId, createdAt: now, updatedAt: now };
}

export function newFolder(name: string, parentId: string | null): Folder {
  return { id: newId(), name, parentId, createdAt: Date.now() };
}
