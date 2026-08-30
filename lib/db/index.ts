import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { databaseUrl } from "./url";

type Db = NodePgDatabase<typeof schema>;
const g = globalThis as unknown as { __listeroDb?: Db };

export function getDb(): Db {
  if (!g.__listeroDb) {
    const pool = new Pool({ connectionString: databaseUrl(), max: 5 });
    g.__listeroDb = drizzle(pool, { schema });
  }
  return g.__listeroDb;
}
