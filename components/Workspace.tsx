"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ListStore } from "@/lib/store/types";
import { newItem, newList, type List } from "@/lib/types";
import ListEditor from "./ListEditor";
import Sidebar from "./Sidebar";

const SAVE_DELAY_MS = 400;

type Props = { store: ListStore; signedIn: boolean };

export default function Workspace({ store, signedIn }: Props) {
  const [lists, setLists] = useState<List[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const listsRef = useRef<List[]>([]);
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
        const all = loaded.map((l) => (l.items.length ? l : { ...l, items: [newItem()] }));
        listsRef.current = all;
        setLists(all);
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

  const handleChange = (id: string, patch: Pick<List, "title" | "items">) => {
    commit(listsRef.current.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: Date.now() } : l)));
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    timers.current.set(id, setTimeout(() => flush(id), SAVE_DELAY_MS));
  };

  const handleCreate = () => {
    const list = newList();
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

  const active = lists?.find((l) => l.id === activeId) ?? null;

  return (
    <div className="app">
      <Sidebar lists={lists ?? []} activeId={activeId} onSelect={setActiveId} onCreate={handleCreate} onDelete={handleDelete} />
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
            <button className="btn" onClick={handleCreate}>
              New list
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
