"use client";

/**
 * Shrinks a photo in the browser before upload.
 *
 * A phone camera shot is far larger than recognition needs, and the Messages
 * API caps an image at 5MB, so resizing here saves upload time and keeps the
 * worker well inside that limit.
 */
export const MAX_DIMENSION = 2048;
export const JPEG_QUALITY = 0.85;

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export class ImageCompressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageCompressionError";
  }
}

function loadBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap rejects formats the browser cannot decode, which is how
  // an HEIC from an iPhone surfaces on a desktop browser.
  return createImageBitmap(file).catch(() => {
    throw new ImageCompressionError("你的瀏覽器無法讀取這張圖片，請改用 JPEG 或 PNG。");
  });
}

function scaledSize(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_DIMENSION) return { width, height };

  const ratio = MAX_DIMENSION / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/**
 * Returns a JPEG no larger than MAX_DIMENSION on its longest side.
 * Throws ImageCompressionError when the browser cannot decode the input.
 */
export async function compressImage(file: File): Promise<File> {
  const bitmap = await loadBitmap(file);

  try {
    const { width, height } = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new ImageCompressionError("無法處理這張圖片，請換一張試試。");

    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });
    if (!blob) throw new ImageCompressionError("無法處理這張圖片，請換一張試試。");

    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
