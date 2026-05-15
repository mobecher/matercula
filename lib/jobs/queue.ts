/**
 * pg-boss queue and job-name registry.
 *
 * Job names are exported as constants so producers and consumers cannot
 * drift apart (typo-proofing the wire contract).
 */
import PgBoss from "pg-boss";

export const TAG_MATERIAL_JOB = "tag-material" as const;

/**
 * Number of retries pg-boss performs before a job is marked `failed`.
 * Mirrored in the worker so the final attempt can persist a terminal
 * status on the `materialien` row instead of leaving it in `processing`.
 */
export const TAG_MATERIAL_RETRY_LIMIT = 5 as const;

export interface TagMaterialPayload {
  materialId: string;
}

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

/**
 * Enqueue a `tagMaterial` job. Caller MUST have already committed the
 * `materialien` row before invoking — otherwise the worker can race ahead
 * and fail to load the row. See `app/api/materialien/route.ts`.
 */
export async function enqueueTagMaterial(payload: TagMaterialPayload): Promise<string | null> {
  const queue = getQueue();
  await queue.start();
  await queue.createQueue(TAG_MATERIAL_JOB);
  return queue.send(TAG_MATERIAL_JOB, payload, {
    retryLimit: TAG_MATERIAL_RETRY_LIMIT,
    retryDelay: 30,
    retryBackoff: true,
  });
}
