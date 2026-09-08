import type { ReactNode } from "react";
import type { DateTag } from "@/lib/types";

type Props = { text: string; dateTags?: DateTag[] };

export default function HighlightedDateText({ text, dateTags }: Props) {
  const content: ReactNode[] = [];
  let cursor = 0;
  for (const tag of dateTags ?? []) {
    content.push(text.slice(cursor, tag.start));
    content.push(
      <span className="date-tag" key={`${tag.start}-${tag.date}`}>
        {text.slice(tag.start, tag.end)}
      </span>,
    );
    cursor = tag.end;
  }
  content.push(text.slice(cursor));
  if (text.endsWith("\n")) content.push("\u200b");
  return content;
}
