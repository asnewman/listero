"use client";

import type { List } from "@/lib/types";

type Props = {
  lists: List[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
};

export default function Sidebar({ lists, activeId, onSelect, onCreate, onDelete }: Props) {
  return (
    <aside className="sidebar">
      <button className="btn new" onClick={onCreate}>
        + New list
      </button>
      <ul className="nav">
        {lists.map((l) => (
          <li key={l.id} className={l.id === activeId ? "active" : ""}>
            <button className="nav-item" onClick={() => onSelect(l.id)} title={l.title || "Untitled"}>
              {l.title || <span className="muted">Untitled</span>}
            </button>
            <button className="nav-delete" onClick={() => onDelete(l.id)} aria-label="Delete list" title="Delete">
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
