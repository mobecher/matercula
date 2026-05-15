/**
 * Internal helper exposing the lazy S3 context built in `s3.ts`.
 *
 * Lives in a sibling module so other storage abstractions (e.g.
 * `material-source.ts`) can issue raw S3 commands without bypassing the
 * lazy-init / env-check logic in `s3.ts`.
 */
import { S3Client } from "@aws-sdk/client-s3";

/**
 * Liest S3-Konfiguration aus den Umgebungsvariablen. Akzeptiert sowohl die
 * projekt-eigenen `S3_*`-Namen als auch die `AWS_*` / `BUCKET_NAME` Namen, die
 * Flys Tigris-Storage-Integration automatisch setzt (siehe `fly storage create`).
 */
const ENV_ALIASES = {
  region: ["S3_REGION", "AWS_REGION"],
  bucket: ["S3_BUCKET", "BUCKET_NAME"],
  accessKey: ["S3_ACCESS_KEY", "AWS_ACCESS_KEY_ID"],
  secretKey: ["S3_SECRET_KEY", "AWS_SECRET_ACCESS_KEY"],
  endpoint: ["S3_ENDPOINT", "AWS_ENDPOINT_URL_S3"],
} as const;

interface S3Context {
  client: S3Client;
  bucket: string;
}

let cached: S3Context | undefined;

const readEnv = (keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
};

const requireEnv = (keys: readonly string[]): string => {
  const value = readEnv(keys);
  if (!value) throw new Error(`${keys[0]} is required`);
  return value;
};

export function getS3Context(): S3Context {
  if (cached) return cached;

  const region = requireEnv(ENV_ALIASES.region);
  const bucket = requireEnv(ENV_ALIASES.bucket);
  const accessKeyId = requireEnv(ENV_ALIASES.accessKey);
  const secretAccessKey = requireEnv(ENV_ALIASES.secretKey);

  const client = new S3Client({
    endpoint: readEnv(ENV_ALIASES.endpoint),
    region,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  cached = { client, bucket };
  return cached;
}
