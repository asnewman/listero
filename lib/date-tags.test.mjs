import assert from "node:assert/strict";
import { test } from "node:test";
import { datePickerStart, resolveDateTags, selectDateTag, updateDateTaggedText } from "./date-tags.ts";

test("@date only triggers at the caret with complete token boundaries", () => {
  assert.equal(datePickerStart("Plan (@date), later", 11), 6);
  for (const [text, caret] of [["a@date", 6], ["@@date", 6], ["@dates", 5], ["@date_", 5], ["@date", 4], ["é@date", 6]]) {
    assert.equal(datePickerStart(text, caret), null);
  }
});

test("selection replaces only the active token and shifts surrounding stored tags", () => {
  const today = "2026-09-12";
  const item = updateDateTaggedText({ text: "" }, "@today / @date / @tomorrow / @date", today);
  const next = selectDateTag(item, 9, "2028-02-29", today);
  assert.equal(next.text, "@today / Feb 29 2028 / @tomorrow / @date");
  assert.deepEqual(next.dateTags, [
    { start: 0, end: 6, date: "2026-09-12" },
    { start: 9, end: 20, date: "2028-02-29" },
    { start: 23, end: 32, date: "2026-09-13" },
  ]);
  assert.deepEqual(resolveDateTags(JSON.parse(JSON.stringify(next)), today), next);
});

test("relative labels retain the selected absolute date after midnight", () => {
  const next = selectDateTag({ text: "Due @date." }, 4, "2026-12-31", "2026-12-30");
  assert.equal(next.text, "Due @tomorrow.");
  assert.deepEqual(resolveDateTags(next, "2027-01-01"), {
    text: "Due @yesterday.", dateTags: [{ start: 4, end: 14, date: "2026-12-31" }],
  });
});
