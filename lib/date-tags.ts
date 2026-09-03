import type { DateTag, ListItem } from "@/lib/types";

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const RELATIVE_DATE_TAG = /(^|[^\p{L}\p{N}_@])@(yesterday|today|tomorrow)(?=$|[^\p{L}\p{N}_@])/gu;
const TOKEN_CHARACTER = /[\p{L}\p{N}_@]/u;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type DateTaggedText = Pick<ListItem, "text" | "dateTags">;

export function localDateKey(date = new Date()): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]);
}

function dateParts(date: string): [number, number, number] {
  const match = DATE_KEY.exec(date);
  if (!match) throw new Error("Invalid date");
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function shiftDate(date: string, days: number): string {
  const [year, month, day] = dateParts(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return [shifted.getUTCFullYear(), String(shifted.getUTCMonth() + 1).padStart(2, "0"), String(shifted.getUTCDate()).padStart(2, "0")].join("-");
}

function absoluteDateLabel(date: string): string {
  const [year, month, day] = dateParts(date);
  return `${MONTHS[month - 1]} ${String(day).padStart(2, "0")} ${year}`;
}

export function dateTagLabel(date: string, today: string): string {
  const [year, month, day] = dateParts(date);
  const [todayYear, todayMonth, todayDay] = dateParts(today);
  const difference =
    (Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / (24 * 60 * 60 * 1000);

  if (difference === -1) return "@yesterday";
  if (difference === 0) return "@today";
  if (difference === 1) return "@tomorrow";
  return absoluteDateLabel(date);
}

function hasTokenBoundaries(text: string, start: number, end: number): boolean {
  return (start === 0 || !TOKEN_CHARACTER.test(text[start - 1])) && (end === text.length || !TOKEN_CHARACTER.test(text[end]));
}

export function isValidDateTag(text: string, value: unknown): value is DateTag {
  if (!value || typeof value !== "object") return false;
  const tag = value as Partial<DateTag>;
  if (!Number.isInteger(tag.start) || !Number.isInteger(tag.end) || !isDateKey(tag.date)) return false;
  const start = tag.start as number;
  const end = tag.end as number;
  if (start < 0 || end <= start || end > text.length || !hasTokenBoundaries(text, start, end)) return false;
  const source = text.slice(start, end);
  return source === "@yesterday" || source === "@today" || source === "@tomorrow" || source === absoluteDateLabel(tag.date);
}

function validStoredTags(text: string, dateTags: DateTag[] | undefined): DateTag[] {
  const valid: DateTag[] = [];
  for (const tag of [...(dateTags ?? [])].sort((a, b) => a.start - b.start)) {
    if (isValidDateTag(text, tag) && (valid.at(-1)?.end ?? 0) <= tag.start) valid.push(tag);
  }
  return valid;
}

function completeDateTags(text: string, candidates: DateTag[], today: string): DateTag[] {
  const dateTags = candidates
    .filter(
      (tag) =>
        isDateKey(tag.date) &&
        Number.isInteger(tag.start) &&
        Number.isInteger(tag.end) &&
        tag.start >= 0 &&
        tag.end <= text.length &&
        tag.start < tag.end &&
        text.slice(tag.start, tag.end) === dateTagLabel(tag.date, today) &&
        hasTokenBoundaries(text, tag.start, tag.end),
    )
    .sort((a, b) => a.start - b.start)
    .filter((tag, index, tags) => index === 0 || tags[index - 1].end <= tag.start);

  for (const match of text.matchAll(RELATIVE_DATE_TAG)) {
    const label = match[2];
    const start = (match.index ?? 0) + match[1].length;
    const end = start + label.length + 1;
    if (dateTags.some((tag) => start < tag.end && end > tag.start)) continue;
    const offset = label === "yesterday" ? -1 : label === "tomorrow" ? 1 : 0;
    dateTags.push({ start, end, date: shiftDate(today, offset) });
  }

  return dateTags.sort((a, b) => a.start - b.start);
}

/** Re-label stored absolute dates for the user's current local calendar day. */
export function resolveDateTags(item: ListItem, today: string): ListItem {
  const stored = validStoredTags(item.text, item.dateTags);
  if (stored.length === 0) return item.dateTags ? { ...item, dateTags: [] } : item;

  let cursor = 0;
  let text = "";
  const dateTags: DateTag[] = [];
  for (const tag of stored) {
    text += item.text.slice(cursor, tag.start);
    const start = text.length;
    text += dateTagLabel(tag.date, today);
    dateTags.push({ ...tag, start, end: text.length });
    cursor = tag.end;
  }
  text += item.text.slice(cursor);
  return { ...item, text, dateTags };
}

/** Preserve unaffected ranges through one textarea edit and recognize newly typed relative tags. */
export function updateDateTaggedText(item: ListItem, text: string, today: string): ListItem {
  let prefix = 0;
  while (prefix < item.text.length && prefix < text.length && item.text[prefix] === text[prefix]) prefix++;

  let suffix = 0;
  while (
    suffix < item.text.length - prefix &&
    suffix < text.length - prefix &&
    item.text[item.text.length - 1 - suffix] === text[text.length - 1 - suffix]
  ) {
    suffix++;
  }

  const oldEnd = item.text.length - suffix;
  const difference = text.length - item.text.length;
  const candidates = (item.dateTags ?? []).flatMap((tag) => {
    if (tag.end <= prefix) return [tag];
    if (tag.start >= oldEnd) return [{ ...tag, start: tag.start + difference, end: tag.end + difference }];
    return [];
  });

  return { ...item, text, dateTags: completeDateTags(text, candidates, today) };
}

export function splitDateTaggedItem(item: ListItem, start: number, end: number, today: string): [DateTaggedText, DateTaggedText] {
  const beforeText = item.text.slice(0, start);
  const afterText = item.text.slice(end);
  const beforeTags = (item.dateTags ?? []).filter((tag) => tag.end <= start);
  const afterTags = (item.dateTags ?? [])
    .filter((tag) => tag.start >= end)
    .map((tag) => ({ ...tag, start: tag.start - end, end: tag.end - end }));
  return [
    { text: beforeText, dateTags: completeDateTags(beforeText, beforeTags, today) },
    { text: afterText, dateTags: completeDateTags(afterText, afterTags, today) },
  ];
}

export function mergeDateTaggedItems(first: ListItem, second: ListItem, today: string): DateTaggedText {
  const text = first.text + second.text;
  const candidates = [
    ...(first.dateTags ?? []),
    ...(second.dateTags ?? []).map((tag) => ({ ...tag, start: tag.start + first.text.length, end: tag.end + first.text.length })),
  ];
  return { text, dateTags: completeDateTags(text, candidates, today) };
}
