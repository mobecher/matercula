import PgBoss from "pg-boss";

let boss: PgBoss | null = null;

export const getQueue = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  if (!boss) {
    boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
  }

  return boss;
};
