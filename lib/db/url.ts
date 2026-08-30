/**
 * Returns DATABASE_URL, normalized so `sslmode=require` keeps its standard libpq
 * meaning (encrypt, don't verify the certificate). `pg` 8.x otherwise treats it
 * as `verify-full`, which fails on providers using self-signed certificates.
 */
export function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const url = new URL(raw);
  if (url.searchParams.get("sslmode") === "require" && !url.searchParams.has("uselibpqcompat")) {
    url.searchParams.set("uselibpqcompat", "true");
  }
  return url.toString();
}
