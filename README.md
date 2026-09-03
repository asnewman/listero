# listero

A writing canvas that only allows lists.

- Signed out: lists live in the browser's local storage.
- Signed in (Clerk): lists are stored in Postgres, per user.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL`. Clerk keys are added by `clerk init`.
3. `npm run db:push` — creates the `lists` table.
4. `npm run dev`

## Editor keys

- `Enter` — new item below
- `Tab` / `Shift+Tab` — indent / outdent (moves nested items with it)
- `Backspace` at the start of an item — merge into the previous item
- `↑` / `↓` — move between items
- `@yesterday` / `@today` / `@tomorrow` — add a date tag that updates as time passes

## Deploy (Vercel)

Set `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` as environment variables. Run `npm run db:push` once against the production database.
