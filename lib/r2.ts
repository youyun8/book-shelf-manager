/**
 * R2 photo storage.
 *
 * The bucket is private and has no public access. Object keys are always
 * `{userId}/{scanId}.{ext}` so ownership is visible in the key itself, and
 * reads still go through an authorisation check before the object is served
 * (see app/api/photo/[scanId]/route.ts).
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Accepted upload types, mapped to the extension used in the object key. */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

export function isAllowedImageType(contentType: string): boolean {
  return contentType.toLowerCase() in ALLOWED_IMAGE_TYPES;
}

export function extensionForType(contentType: string): string {
  return ALLOWED_IMAGE_TYPES[contentType.toLowerCase()] ?? "jpg";
}

export function photoKey(userId: string, scanId: string, extension: string): string {
  return `${userId}/${scanId}.${extension}`;
}

/** Guards against a key from the database being used to read someone else's object. */
export function keyBelongsToUser(key: string, userId: string): boolean {
  return key.startsWith(`${userId}/`);
}

async function bucket(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true });
  return env.PHOTOS;
}

export async function putPhoto(
  key: string,
  body: ArrayBuffer | ReadableStream,
  contentType: string,
): Promise<void> {
  await (
    await bucket()
  ).put(key, body, {
    httpMetadata: { contentType, cacheControl: "private, max-age=3600" },
  });
}

export async function getPhoto(key: string): Promise<R2ObjectBody | null> {
  return (await bucket()).get(key);
}

export async function deletePhoto(key: string): Promise<void> {
  await (await bucket()).delete(key);
}

/** Removes every object under a user's prefix, used by "delete all my data". */
export async function deleteUserPhotos(userId: string): Promise<number> {
  const store = await bucket();
  let deleted = 0;
  let cursor: string | undefined;

  do {
    const listing = await store.list({ prefix: `${userId}/`, cursor });
    const keys = listing.objects.map((object) => object.key);
    if (keys.length > 0) {
      await store.delete(keys);
      deleted += keys.length;
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  return deleted;
}
