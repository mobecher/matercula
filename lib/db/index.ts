import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/matercula";

export const sqlClient = postgres(connectionString, {
  prepare: false,
  max: 10,
});

export const db = drizzle(sqlClient);
