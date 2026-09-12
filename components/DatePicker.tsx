"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { localDateKey } from "@/lib/date-tags";

type Props = { today: string; onSelect: (date: string) => void; onCancel: () => void };

export default function DatePicker({ today, onSelect, onCancel }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [month, setMonth] = useState(() => new Date(`${today}T12:00:00`));
  const year = month.getFullYear();
  const index = month.getMonth();
  const firstDay = new Date(year, index, 1).getDay();
  const days = new Date(year, index + 1, 0).getDate();

  useLayoutEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);

  return (
    <dialog ref={dialog} className="date-picker" aria-labelledby="date-picker-title" onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      <h2 id="date-picker-title">Choose a date</h2>
      <div className="date-picker-heading">
        <button className="btn" aria-label="Previous month" onClick={() => setMonth(new Date(year, index - 1, 1))}>←</button>
        <span aria-live="polite">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button className="btn" aria-label="Next month" onClick={() => setMonth(new Date(year, index + 1, 1))}>→</button>
      </div>
      <div className="date-picker-days">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span className="muted" key={day}>{day}</span>)}
        {Array.from({ length: firstDay }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const date = localDateKey(new Date(year, index, i + 1));
          return <button key={date} className="btn" aria-label={date} aria-current={date === today ? "date" : undefined} autoFocus={date === today} onClick={() => onSelect(date)}>{i + 1}</button>;
        })}
      </div>
      <div className="date-picker-heading">
        <button className="btn" onClick={() => onSelect(today)}>Today</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </dialog>
  );
}
