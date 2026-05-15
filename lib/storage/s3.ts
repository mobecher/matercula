import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Context } from "./s3-context";

export const uploadFile = async (
  key: string,
  body: PutObjectCommandInput["Body"],
  contentType: string,
) => {
  const { client, bucket } = getS3Context();
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
  const { client, bucket } = getS3Context();
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
  const { client, bucket } = getS3Context();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
};
