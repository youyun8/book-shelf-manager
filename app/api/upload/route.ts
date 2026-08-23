import { requireApiUser } from "@/lib/auth/require-user";
import { createScan } from "@/lib/data/scans";
import {
  MAX_UPLOAD_BYTES,
  extensionForType,
  isAllowedImageType,
  photoKey,
  putPhoto,
} from "@/lib/r2";

/**
 * Receives a photo and opens a scan for it.
 *
 * The upload is written to R2 by the worker rather than through a presigned
 * PUT: the R2 binding is already available here, a presigned URL would need
 * S3 credentials as extra secrets plus CORS on the bucket, and at a 10MB cap
 * the request comfortably fits through the worker. See DECISIONS.md.
 */
export async function POST(request: Request): Promise<Response> {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "請以表單方式上傳檔案。" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "沒有收到檔案。" }, { status: 400 });
  }

  if (!isAllowedImageType(file.type)) {
    return Response.json({ error: "只接受 JPEG、PNG、WebP 或 HEIC 圖片。" }, { status: 415 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "單張圖片不能超過 10MB。" }, { status: 413 });
  }

  if (file.size === 0) {
    return Response.json({ error: "檔案是空的。" }, { status: 400 });
  }

  // The key embeds the owner, so an object can never be reached from another
  // user's scan record.
  const scanId = crypto.randomUUID();
  const key = photoKey(user.id, scanId, extensionForType(file.type));

  await putPhoto(key, await file.arrayBuffer(), file.type);
  const scan = await createScan(user.id, { id: scanId, r2Key: key });

  return Response.json({ scanId: scan.id, status: scan.status }, { status: 201 });
}
