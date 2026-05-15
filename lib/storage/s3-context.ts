/**
 * Internal helper exposing the lazy S3 context built in `s3.ts`.
 *
 * Lives in a sibling module so other storage abstractions (e.g.
 * `material-source.ts`) can issue raw S3 commands without bypassing the
 * lazy-init / env-check logic in `s3.ts`.
 */
import { S3Client } from "@aws-sdk/client-s3";

const required = ["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"] as const;

interface S3Context {
  client: S3Client;
  bucket: string;
}

let cached: S3Context | undefined;

export function getS3Context(): S3Context {
  if (cached) return cached;

  for (const key of required) {
    if (!process.env[key]) throw new Error(`${key} is required`);
  }

  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY as string,
      secretAccessKey: process.env.S3_SECRET_KEY as string,
    },
  });

  cached = { client, bucket: process.env.S3_BUCKET as string };
  return cached;
}
