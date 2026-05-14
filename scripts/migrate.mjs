import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/matercula";
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);
try {
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  console.log("OK");
} catch (e) {
  console.error("FAIL:", e);
  process.exit(1);
} finally {
  await sql.end();
}
