import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";

const required = ["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"] as const;

interface S3Context {
  client: S3Client;
  bucket: string;
}

// Lazy-init: Modul-Import darf nicht fehlschlagen (z. B. während
// `next build` → "Collecting page data", wo Env-Vars fehlen).
let cached: S3Context | undefined;

function getContext(): S3Context {
  if (cached) return cached;

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`${key} is required`);
    }
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

export const uploadFile = async (
  key: string,
  body: PutObjectCommandInput["Body"],
  contentType: string,
) => {
  const { client, bucket } = getContext();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return { key };
};

export const getSignedUrl = async (key: string, expiresIn = 3600) => {
  const { client, bucket } = getContext();
  return awsGetSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn },
  );
};

export const deleteFile = async (key: string) => {
  const { client, bucket } = getContext();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
};
