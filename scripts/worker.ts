/**
 * Long-running pg-boss worker process.
 *
 * Run with:  pnpm worker         (alias for `tsx scripts/worker.ts`)
 * Container: started by the docker-compose `worker` service and on Fly by
 *            the `matercula-worker` app.
 */

import type PgBoss from "pg-boss";
import type { TagMaterialPayload } from "@/lib/jobs/queue";
import { getQueue, TAG_MATERIAL_JOB } from "@/lib/jobs/queue";
import { handleTagMaterial } from "@/lib/jobs/tag-material";

async function main(): Promise<void> {
  const queue = getQueue();
  await queue.start();
  await queue.createQueue(TAG_MATERIAL_JOB);

  await queue.work<TagMaterialPayload>(
    TAG_MATERIAL_JOB,
    { batchSize: 1 },
    async (jobs: PgBoss.Job<TagMaterialPayload>[]) => {
      for (const job of jobs) {
        await handleTagMaterial(job.data);
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
