import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import s3, { S3_BUCKET } from "../config/s3.js";
import { buildBatchNumber } from "../utils/batchUtils.js";

function buildObjectKey({
  batch,
  folder,
  fileId,
  extension,
}) {
  const batchFolder = buildBatchNumber(batch);

  return `${batchFolder}/${folder}/${fileId}${extension}`;
}

/**
 * Upload file
 */
export async function uploadFile({
  batch,
  folder,
  fileId,
  buffer,
  contentType,
  extension = ".pdf",
}) {
  const key = buildObjectKey({
    batch,
    folder,
    fileId,
    extension,
  });

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return { key };
  } catch (err) {
    console.error("[S3 Upload Error]", err);
    throw new Error("Failed to upload file to storage.");
  }
}

/**
 * Delete file
 */
export async function deleteFile(key) {
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })
    );
  } catch (err) {
    console.error("[S3 Delete Error]", err);
    throw new Error("Failed to delete file from storage.");
  }
}

/**
 * Returns Buffer
 */
export async function downloadFile(key){
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })
    );

    return Buffer.from(
      await response.Body.transformToByteArray()
    );
  } catch (err) {
    console.error("[S3 Buffer Error]", err);
    throw new Error("Failed to read file from storage.");
  }
}

/**
 * Returns Readable Stream
 */
export async function getFileStream(key) {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })
    );

    return response.Body;
  } catch (err) {
    console.error("[S3 Stream Error]", err);
    throw new Error("Failed to read file from storage.");
  }
}