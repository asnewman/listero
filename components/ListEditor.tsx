"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  localDateKey,
  mergeDateTaggedItems,
  resolveDateTags,
  splitDateTaggedItem,
  updateDateTaggedText,
} from "@/lib/date-tags";
import { MAX_DEPTH, newItem, type List, type ListItem } from "@/lib/types";

type Patch = Pick<List, "title" | "items">;
type Props = { list: List; autoFocusTitle?: boolean; onChange: (patch: Patch) => void };
type Focus = { id: string; pos: number };

export default function ListEditor({ list, autoFocusTitle, onChange }: Props) {
  const [focus, setFocus] = useState<Focus | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const today = useLocalDate();
  const keyboardInset = useKeyboardInset();
  const titleRef = useRef<HTMLInputElement>(null);
  const items = list.items.map((item) => resolveDateTags(item, today));

  const setItems = (next: ListItem[], nextFocus?: Focus) => {
    onChange({ title: list.title, items: next });
    if (nextFocus) setFocus(nextFocus);
  };

  /** Index just past the subtree rooted at `i` (following items deeper than items[i]). */
  const subtreeEnd = (i: number) => {
    let j = i + 1;
    while (j < items.length && items[j].depth > items[i].depth) j++;
    return j;
  };

  const shiftDepth = (i: number, delta: number) => {
    const maxDepth = i === 0 ? 0 : Math.min(items[i - 1].depth + 1, MAX_DEPTH);
    const target = Math.max(0, Math.min(items[i].depth + delta, maxDepth));
    const d = target - items[i].depth;
    if (d === 0) return;
    const end = subtreeEnd(i);
    setItems(items.map((it, k) => (k >= i && k < end ? { ...it, depth: Math.max(0, it.depth + d) } : it)));
  };

  /** Move items[i] and its subtree past the sibling above (dir -1) or below (dir 1). */
  const moveItem = (i: number, dir: -1 | 1, pos: number) => {
    const item = items[i];
    const end = subtreeEnd(i);
    const block = items.slice(i, end);
    let next: ListItem[];
    if (dir < 0) {
      let j = i - 1;
      while (j >= 0 && items[j].depth > item.depth) j--;
      if (j < 0 || items[j].depth < item.depth) return; // no sibling above
      next = [...items.slice(0, j), ...block, ...items.slice(j, i), ...items.slice(end)];
    } else {
      if (end >= items.length || items[end].depth < item.depth) return; // no sibling below
      const after = subtreeEnd(end);
      next = [...items.slice(0, i), ...items.slice(end, after), ...block, ...items.slice(after)];
    }
    setItems(next, { id: item.id, pos });
  };

  /** Row holding the caret — the touch toolbar acts on it, having no keyboard to act through. */
  const editing = () => {
    const i = items.findIndex((it) => it.id === editingId);
    if (i < 0) return null;
    const el = document.activeElement;
    return { i, pos: el instanceof HTMLTextAreaElement ? el.selectionStart : items[i].text.length };
  };

  const nudgeDepth = (delta: number) => {
    const at = editing();
    if (!at) return;
    shiftDepth(at.i, delta);
    setFocus({ id: items[at.i].id, pos: at.pos });
  };

  const nudgeMove = (dir: -1 | 1) => {
    const at = editing();
    if (!at) return;
    moveItem(at.i, dir, at.pos);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, i: number) => {
    const el = e.currentTarget;
    const item = items[i];
    const start = el.selectionStart;
    const end = el.selectionEnd;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const [before, after] = splitDateTaggedItem(item, start, end, today);
      const hasChildren = i + 1 < items.length && items[i + 1].depth > item.depth;
      const created = { ...newItem(hasChildren && after.text === "" ? item.depth + 1 : item.depth, after.text), ...after };
      const next = [...items];
      next.splice(i, 1, { ...item, ...before }, created);
      setItems(next, { id: created.id, pos: 0 });
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      shiftDepth(i, e.shiftKey ? -1 : 1);
      return;
    }

    if (e.key === "Backspace" && start === 0 && end === 0) {
      if (i > 0) {
        e.preventDefault();
        const prev = items[i - 1];
        const merged = mergeDateTaggedItems(prev, item, today);
        const next = [...items];
        next.splice(i - 1, 2, { ...prev, ...merged });
        setItems(next, { id: prev.id, pos: prev.text.length });
      } else if (item.text === "" && items.length > 1) {
        e.preventDefault();
        setItems(items.slice(1), { id: items[1].id, pos: 0 });
      }
      return;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const up = e.key === "ArrowUp";
      if (e.shiftKey) {
        e.preventDefault();
        moveItem(i, up ? -1 : 1, start);
        return;
      }
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
      const wrapped = el.clientHeight >= lineHeight * 2;
      const atEdge = up ? start === 0 : start === el.value.length;
      if (wrapped && !atEdge) return;
      const j = up ? i - 1 : i + 1;
      if (j >= items.length) return;
      e.preventDefault();
      if (j < 0) {
        titleRef.current?.focus();
        return;
      }
      setFocus({ id: items[j].id, pos: Math.min(start, items[j].text.length) });
    }
  };

  const handleText = (i: number, text: string) => {
    setItems(items.map((it, k) => (k === i ? updateDateTaggedText(it, text, today) : it)));
  };

  return (
    <div className="editor">
      <input
        ref={titleRef}
        className="title"
        autoFocus={autoFocusTitle}
        value={list.title}
        placeholder="Untitled"
        onChange={(e) => onChange({ title: e.target.value, items })}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "ArrowDown") {
            e.preventDefault();
            setFocus({ id: items[0].id, pos: 0 });
          }
        }}
      />
      <div className="items">
        {items.map((item, i) => (
          <Row
            key={item.id}
            item={item}
            focus={focus?.id === item.id ? focus : null}
            onFocused={() => setFocus(null)}
            onText={(t) => handleText(i, t)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onEnter={() => setEditingId(item.id)}
            onLeave={() => setEditingId((cur) => (cur === item.id ? null : cur))}
          />
        ))}
      </div>
      {editingId && (
        <div className="touchbar" style={{ bottom: keyboardInset }}>
          {/* pointerdown is cancelled so tapping never blurs the row being edited */}
          <div className="touchbar-group">
            <button className="btn" aria-label="Move up" onPointerDown={(e) => e.preventDefault()} onClick={() => nudgeMove(-1)}>
              &#8593;
            </button>
            <button className="btn" aria-label="Move down" onPointerDown={(e) => e.preventDefault()} onClick={() => nudgeMove(1)}>
              &#8595;
            </button>
          </div>
          <div className="touchbar-group">
            <button className="btn" aria-label="Outdent" onPointerDown={(e) => e.preventDefault()} onClick={() => nudgeDepth(-1)}>
              &#8676;
            </button>
            <button className="btn" aria-label="Indent" onPointerDown={(e) => e.preventDefault()} onClick={() => nudgeDepth(1)}>
              &#8677;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Current local calendar day, refreshed at midnight and after returning to the tab. */
function useLocalDate() {
  const [today, setToday] = useState(localDateKey);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => {
        setToday(localDateKey());
        scheduleMidnight();
      }, midnight.getTime() - now.getTime() + 100);
    };
    const refresh = () => setToday(localDateKey());

    scheduleMidnight();
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return today;
}

/** Height of the on-screen keyboard, so fixed UI can sit on top of it instead of behind it. */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}

type RowProps = {
  item: ListItem;
  focus: Focus | null;
  onFocused: () => void;
  onText: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onEnter: () => void;
  onLeave: () => void;
};

function Row({ item, focus, onFocused, onText, onKeyDown, onEnter, onLeave }: RowProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [item.text, item.depth]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !focus) return;
    el.focus();
    el.setSelectionRange(focus.pos, focus.pos);
    onFocused();
  }, [focus, onFocused]);

  return (
    <div className="item" style={{ paddingLeft: `${item.depth * 1.5}rem` }}>
      <span className="bullet" aria-hidden>
        {item.depth % 2 === 0 ? "•" : "◦"}
      </span>
      <div className="item-text">
        <HighlightedText item={item} />
        <textarea
          ref={ref}
          rows={1}
          value={item.text}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={onEnter}
          onBlur={onLeave}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function HighlightedText({ item }: { item: ListItem }) {
  const content: React.ReactNode[] = [];
  let cursor = 0;
  for (const tag of item.dateTags ?? []) {
    content.push(item.text.slice(cursor, tag.start));
    content.push(
      <span className="date-tag" key={`${tag.start}-${tag.date}`}>
        {item.text.slice(tag.start, tag.end)}
      </span>,
    );
    cursor = tag.end;
  }
  content.push(item.text.slice(cursor));
  if (item.text.endsWith("\n")) content.push("\u200b");
  return (
    <div className="item-render" aria-hidden>
      {content}
    </div>
  );
}
