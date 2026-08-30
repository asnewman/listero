export type ListItem = {
  id: string;
  text: string;
  depth: number;
};

export type List = {
  id: string;
  title: string;
  items: ListItem[];
  createdAt: number;
  updatedAt: number;
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
  return { id: newId(), text, depth };
}

export function newList(): List {
  const now = Date.now();
  return { id: newId(), title: "", items: [newItem()], createdAt: now, updatedAt: now };
}
