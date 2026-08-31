"use client";

import { useEffect, useRef, useState } from "react";
import type { Folder, List } from "@/lib/types";

type Drag = { kind: "list" | "folder"; id: string };

type Props = {
  lists: List[];
  folders: Folder[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (folderId: string | null) => void;
  onDelete: (id: string) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onDeleteFolder: (id: string) => void;
  onMoveList: (id: string, folderId: string | null) => void;
  onMoveFolder: (id: string, parentId: string | null) => void;
};

export default function Sidebar({
  lists,
  folders,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onCreateFolder,
  onDeleteFolder,
  onMoveList,
  onMoveFolder,
}: Props) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  // false = no name input open; null = naming a top-level folder; string = naming inside that folder
  const [namingIn, setNamingIn] = useState<string | null | false>(false);
  const [menuFor, setMenuFor] = useState<Drag | null>(null);
  const [dragOver, setDragOver] = useState<string | "root" | null>(null);
  const dragRef = useRef<Drag | null>(null);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);

  const parentOf = new Map(folders.map((f) => [f.id, f.parentId]));

  const inSubtree = (ancestorId: string, folderId: string | null) => {
    for (let cur: string | null = folderId; cur !== null; cur = parentOf.get(cur) ?? null) {
      if (cur === ancestorId) return true;
    }
    return false;
  };

  const flatFolders: { folder: Folder; depth: number }[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const f of folders.filter((x) => x.parentId === parentId)) {
      flatFolders.push({ folder: f, depth });
      visit(f.id, depth + 1);
    }
  };
  visit(null, 0);

  const expand = (id: string) =>
    setCollapsed((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleMenu = (d: Drag) => setMenuFor((m) => (m && m.kind === d.kind && m.id === d.id ? null : d));

  const canDrop = (target: string | null): boolean => {
    const d = dragRef.current;
    if (!d) return false;
    if (d.kind === "list") {
      const list = lists.find((l) => l.id === d.id);
      return !!list && (list.folderId ?? null) !== target;
    }
    const folder = folders.find((f) => f.id === d.id);
    if (!folder || folder.parentId === target) return false;
    return target === null || !inSubtree(folder.id, target);
  };

  const drop = (target: string | null) => {
    const ok = canDrop(target);
    const d = dragRef.current;
    dragRef.current = null;
    setDragOver(null);
    if (!ok || !d) return;
    if (d.kind === "list") onMoveList(d.id, target);
    else onMoveFolder(d.id, target);
    if (target) expand(target);
  };

  const startDrag = (e: React.DragEvent, d: Drag) => {
    dragRef.current = d;
    e.dataTransfer.effectAllowed = "move";
    // Firefox won't start a drag without data attached
    e.dataTransfer.setData("text/plain", d.id);
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragOver(null);
  };

  // target null means the top level; those events also bubble to the root handlers on <aside>
  const dropProps = (target: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragRef.current) return;
      if (target !== null) e.stopPropagation();
      if (!canDrop(target)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOver(target ?? "root");
    },
    onDragLeave: (e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setDragOver((cur) => (cur === (target ?? "root") ? null : cur));
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (target !== null) e.stopPropagation();
      drop(target);
    },
  });

  const renderMenu = (d: Drag, folder?: Folder) => {
    const current =
      d.kind === "list"
        ? (lists.find((l) => l.id === d.id)?.folderId ?? null)
        : (folders.find((f) => f.id === d.id)?.parentId ?? null);
    const targets: { id: string | null; name: string; depth: number }[] = [];
    if (current !== null) targets.push({ id: null, name: "Top level", depth: 0 });
    for (const { folder: f, depth } of flatFolders) {
      if (f.id === current) continue;
      if (d.kind === "folder" && inSubtree(d.id, f.id)) continue;
      targets.push({ id: f.id, name: f.name || "Untitled", depth });
    }
    return (
      <div className="menu">
        {folder && (
          <>
            <button onClick={() => { expand(folder.id); onCreate(folder.id); }}>New list</button>
            <button onClick={() => { expand(folder.id); setNamingIn(folder.id); }}>New subfolder</button>
          </>
        )}
        <div className="menu-label">Move to</div>
        {targets.length === 0 ? (
          <div className="menu-label">No folders yet</div>
        ) : (
          targets.map((t) => (
            <button
              key={t.id ?? "top"}
              style={{ paddingLeft: `${0.6 + t.depth * 0.8}rem` }}
              onClick={() => {
                if (d.kind === "list") onMoveList(d.id, t.id);
                else onMoveFolder(d.id, t.id);
                if (t.id) expand(t.id);
              }}
            >
              {t.name}
            </button>
          ))
        )}
      </div>
    );
  };

  const nameInput = (parentId: string | null) => (
    <li className="folder-new" key="new-folder">
      <input
        autoFocus
        placeholder="Folder name"
        aria-label="Folder name"
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") {
            e.currentTarget.dataset.cancel = "1";
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => {
          const name = e.currentTarget.dataset.cancel ? "" : e.currentTarget.value.trim();
          setNamingIn(false);
          if (name) onCreateFolder(name, parentId);
        }}
      />
    </li>
  );

  const renderList = (l: List) => (
    <li
      key={l.id}
      className={l.id === activeId ? "active" : ""}
      draggable
      onDragStart={(e) => startDrag(e, { kind: "list", id: l.id })}
      onDragEnd={endDrag}
      {...dropProps(l.folderId ?? null)}
    >
      <button className="nav-item" onClick={() => onSelect(l.id)} title={l.title || "Untitled"}>
        {l.title || <span className="muted">Untitled</span>}
      </button>
      <button
        className="nav-menu-btn"
        onClick={(e) => {
          e.stopPropagation();
          toggleMenu({ kind: "list", id: l.id });
        }}
        aria-label="Move list"
        title="Move"
      >
        ⋯
      </button>
      <button className="nav-delete" onClick={() => onDelete(l.id)} aria-label="Delete list" title="Delete">
        ×
      </button>
      {menuFor?.kind === "list" && menuFor.id === l.id && renderMenu(menuFor)}
    </li>
  );

  const renderFolder = (f: Folder) => {
    const isCollapsed = collapsed.has(f.id);
    return (
      <li key={f.id} className="folder">
        <div
          className={"folder-row" + (dragOver === f.id ? " drag-over" : "")}
          draggable
          onDragStart={(e) => startDrag(e, { kind: "folder", id: f.id })}
          onDragEnd={endDrag}
          {...dropProps(f.id)}
        >
          <button className="nav-item" onClick={() => toggle(f.id)} title={f.name || "Untitled"}>
            <span className="chevron">{isCollapsed ? "▸" : "▾"}</span>
            {f.name || <span className="muted">Untitled</span>}
          </button>
          <button
            className="nav-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleMenu({ kind: "folder", id: f.id });
            }}
            aria-label="Folder menu"
            title="Folder menu"
          >
            ⋯
          </button>
          <button className="nav-delete" onClick={() => onDeleteFolder(f.id)} aria-label="Delete folder" title="Delete">
            ×
          </button>
          {menuFor?.kind === "folder" && menuFor.id === f.id && renderMenu(menuFor, f)}
        </div>
        {!isCollapsed && <ul className="nav sub">{renderLevel(f.id)}</ul>}
      </li>
    );
  };

  const renderLevel = (parentId: string | null) => (
    <>
      {namingIn === parentId && nameInput(parentId)}
      {folders.filter((f) => f.parentId === parentId).map(renderFolder)}
      {lists.filter((l) => (l.folderId ?? null) === parentId).map(renderList)}
    </>
  );

  return (
    <aside
      className={"sidebar" + (dragOver === "root" ? " drag-over-root" : "")}
      onDragOver={(e) => {
        if (!canDrop(null)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver("root");
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver((cur) => (cur === "root" ? null : cur));
      }}
      onDrop={(e) => {
        e.preventDefault();
        drop(null);
      }}
    >
      <div className="sidebar-new">
        <button className="btn new" onClick={() => onCreate(null)}>
          + New list
        </button>
        <button className="btn new" onClick={() => setNamingIn(null)}>
          + New folder
        </button>
      </div>
      <ul className="nav">{renderLevel(null)}</ul>
    </aside>
  );
}
