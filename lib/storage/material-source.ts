/**
 * MaterialSource — abstraction over where a material's bytes live.
 *
 * Today: S3-compatible storage (MinIO locally, AWS/Tigris in production).
 * Future: Google Drive integration for hosted teachers.
 *
 * The job pipeline (see `lib/jobs/tag-material.ts`) only knows about this
 * interface, so adding a new source means implementing one method.
 */
import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { Material } from "@/lib/db/schema/materials";
import { getS3Context } from "./s3-context";

export interface MaterialSource {
  fetchBytes(material: Pick<Material, "storageKey">): Promise<Buffer>;
}

class S3MaterialSource implements MaterialSource {
  async fetchBytes(material: Pick<Material, "storageKey">): Promise<Buffer> {
    const { client, bucket } = getS3Context();
    const result = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: material.storageKey }),
    );
    if (!result.Body) {
      throw new Error(`empty body for storage key ${material.storageKey}`);
    }
    // The AWS SDK v3 stream has transformToByteArray(); fall back if missing.
    const body = result.Body as { transformToByteArray?: () => Promise<Uint8Array> };
    if (typeof body.transformToByteArray === "function") {
      const bytes = await body.transformToByteArray();
      return Buffer.from(bytes);
    }
    // Node Readable stream fallback.
    const stream = result.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}

export const defaultMaterialSource: MaterialSource = new S3MaterialSource();
