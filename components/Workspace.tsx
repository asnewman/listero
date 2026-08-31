"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ListStore } from "@/lib/store/types";
import { newFolder, newItem, newList, type Folder, type List } from "@/lib/types";
import ListEditor from "./ListEditor";
import Sidebar from "./Sidebar";

const SAVE_DELAY_MS = 400;

type Props = { store: ListStore; signedIn: boolean };

export default function Workspace({ store, signedIn }: Props) {
  const [lists, setLists] = useState<List[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const listsRef = useRef<List[]>([]);
  const foldersRef = useRef<Folder[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const fail = useCallback((e: unknown) => {
    console.error(e);
    setError("Couldn't save. Check your connection and try again.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    store
      .getAll()
      .then((loaded) => {
        if (cancelled) return;
        const all = loaded.lists.map((l) => (l.items.length ? l : { ...l, items: [newItem()] }));
        listsRef.current = all;
        foldersRef.current = loaded.folders;
        setLists(all);
        setFolders(loaded.folders);
        setActiveId(all[0]?.id ?? null);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setError("Couldn't load your lists.");
        setLists([]);
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const flush = useCallback(
    (id: string) => {
      const t = timers.current.get(id);
      if (!t) return;
      clearTimeout(t);
      timers.current.delete(id);
      const list = listsRef.current.find((l) => l.id === id);
      if (!list) return;
      store.update(id, { title: list.title, items: list.items, updatedAt: list.updatedAt }).then(() => setError(null), fail);
    },
    [store, fail],
  );

  const flushAll = useCallback(() => {
    for (const id of Array.from(timers.current.keys())) flush(id);
  }, [flush]);

  useEffect(() => {
    window.addEventListener("pagehide", flushAll);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      flushAll();
    };
  }, [flushAll]);

  const commit = (next: List[]) => {
    listsRef.current = next;
    setLists(next);
  };

  const commitFolders = (next: Folder[]) => {
    foldersRef.current = next;
    setFolders(next);
  };

  const handleChange = (id: string, patch: Pick<List, "title" | "items">) => {
    commit(listsRef.current.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: Date.now() } : l)));
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    timers.current.set(id, setTimeout(() => flush(id), SAVE_DELAY_MS));
  };

  const handleCreate = (folderId: string | null) => {
    const list = newList(folderId);
    commit([list, ...listsRef.current]);
    setActiveId(list.id);
    setCreatedId(list.id);
    store.create(list).then(() => setError(null), fail);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this list?")) return;
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    const next = listsRef.current.filter((l) => l.id !== id);
    commit(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
    store.remove(id).then(() => setError(null), fail);
  };

  const handleMoveList = (id: string, folderId: string | null) => {
    commit(listsRef.current.map((l) => (l.id === id ? { ...l, folderId } : l)));
    store.moveList(id, folderId).then(() => setError(null), fail);
  };

  const handleCreateFolder = (name: string, parentId: string | null) => {
    const folder = newFolder(name, parentId);
    commitFolders([folder, ...foldersRef.current]);
    store.createFolder(folder).then(() => setError(null), fail);
  };

  const handleMoveFolder = (id: string, parentId: string | null) => {
    commitFolders(foldersRef.current.map((f) => (f.id === id ? { ...f, parentId } : f)));
    store.moveFolder(id, parentId).then(() => setError(null), fail);
  };

  const handleDeleteFolder = (id: string) => {
    if (!window.confirm("Delete this folder? Everything inside moves up a level.")) return;
    const target = foldersRef.current.find((f) => f.id === id);
    if (!target) return;
    commitFolders(
      foldersRef.current.filter((f) => f.id !== id).map((f) => (f.parentId === id ? { ...f, parentId: target.parentId } : f)),
    );
    commit(listsRef.current.map((l) => (l.folderId === id ? { ...l, folderId: target.parentId } : l)));
    store.removeFolder(id).then(() => setError(null), fail);
  };

  const active = lists?.find((l) => l.id === activeId) ?? null;

  return (
    <div className="app">
      <Sidebar
        lists={lists ?? []}
        folders={folders}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={handleCreate}
        onDelete={handleDelete}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onMoveList={handleMoveList}
        onMoveFolder={handleMoveFolder}
      />
      <main className="main">
        <header className="topbar">
          <span className="status">{error ?? (signedIn ? "" : "Lists are saved in this browser only")}</span>
          {signedIn ? (
            <UserButton />
          ) : (
            <SignInButton mode="modal">
              <button className="btn">Sign in</button>
            </SignInButton>
          )}
        </header>
        {lists === null ? null : active ? (
          <ListEditor
            key={active.id}
            list={active}
            autoFocusTitle={active.id === createdId}
            onChange={(patch) => handleChange(active.id, patch)}
          />
        ) : (
          <div className="empty">
            <button className="btn" onClick={() => handleCreate(null)}>
              New list
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
