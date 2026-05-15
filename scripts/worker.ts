/**
 * Long-running pg-boss worker process.
 *
 * Run with:  pnpm worker         (alias for `tsx scripts/worker.ts`)
 * Container: started by the docker-compose `worker` service and on Fly by
 *            the `matercula-worker` app.
 */

import { eq } from "drizzle-orm";
import type PgBoss from "pg-boss";
import { db } from "@/lib/db";
import { materialien } from "@/lib/db/schema/materials";
import type { TagMaterialPayload } from "@/lib/jobs/queue";
import { getQueue, TAG_MATERIAL_JOB, TAG_MATERIAL_RETRY_LIMIT } from "@/lib/jobs/queue";
import { handleTagMaterial } from "@/lib/jobs/tag-material";

async function main(): Promise<void> {
  const queue = getQueue();
  await queue.start();
  await queue.createQueue(TAG_MATERIAL_JOB);

  await queue.work<TagMaterialPayload>(
    TAG_MATERIAL_JOB,
    { batchSize: 1, includeMetadata: true },
    async (jobs: PgBoss.JobWithMetadata<TagMaterialPayload>[]) => {
      for (const job of jobs) {
        try {
          await handleTagMaterial(job.data);
        } catch (err) {
          // pg-boss retries until `retryLimit`; on the final attempt we'd
          // otherwise leave the materialien row stuck in `processing`
          // forever (the UI polls for any change). Persist a terminal
          // `error` status so the user sees the failure and we re-throw
          // so pg-boss still records the job as failed.
          const isFinalAttempt = (job.retryCount ?? 0) >= TAG_MATERIAL_RETRY_LIMIT;
          if (isFinalAttempt) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(
              `[worker] tag-material exhausted retries for material ${job.data.materialId}: ${message}`,
            );
            try {
              await db
                .update(materialien)
                .set({
                  status: "error",
                  statusReason: `worker:retries_exhausted:${message}`.slice(0, 500),
                  updatedAt: new Date(),
                })
                .where(eq(materialien.id, job.data.materialId));
            } catch (updateErr) {
              console.error("[worker] failed to mark material as error", updateErr);
            }
          }
          throw err;
        }
      }
    },
  );

  console.log(`[worker] listening for ${TAG_MATERIAL_JOB} jobs`);

  const shutdown = async (signal: string) => {
    console.log(`[worker] received ${signal}, shutting down`);
    try {
      await queue.stop({ graceful: true, wait: true });
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
