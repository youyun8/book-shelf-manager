/**
 * Turns an uploaded photo into book rows.
 *
 * Runs behind `ctx.waitUntil` rather than inside the request, because
 * recognising a shelf plus one Google Books lookup per book routinely takes
 * longer than a request should be held open. The client polls
 * GET /api/scan/[id] for the outcome.
 */
import { createBookIfNew } from "@/lib/data/books";
import { getScan, markScanDone, markScanFailed, markScanProcessing } from "@/lib/data/scans";
import { lookupBook } from "@/lib/google-books";
import { getPhoto } from "@/lib/r2";
import {
  REVIEW_CONFIDENCE_THRESHOLD,
  VISION_ERROR_MESSAGES,
  VisionError,
  type DetectedBook,
  recognizeBooks,
} from "@/lib/vision";

export type ProcessScanOptions = {
  userId: string;
  scanId: string;
  apiKey: string | undefined;
  /** Injected by tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
};

export type ProcessScanResult = {
  status: "done" | "failed";
  detectedCount: number;
  errorMessage?: string;
};

/**
 * Merges what the model read with what Google Books knows.
 *
 * The lookup wins on the bibliographic fields, because a catalogue entry beats
 * a guess made from a photographed spine -- but only where it actually has a
 * value, so a sparse record never erases what was legible on the cover.
 */
function mergeMetadata(detected: DetectedBook, metadata: Awaited<ReturnType<typeof lookupBook>>) {
  const lowConfidence = detected.confidence < REVIEW_CONFIDENCE_THRESHOLD;

  if (!metadata) {
    return {
      title: detected.title,
      subtitle: null,
      authors: detected.authors,
      publisher: detected.publisher,
      publishedDate: null,
      isbn10: null,
      isbn13: detected.isbn?.length === 13 ? detected.isbn : null,
      pageCount: null,
      categories: [],
      description: null,
      language: null,
      coverUrl: null,
      confidence: detected.confidence,
      // Nothing corroborated the reading, so ask the user to check it.
      needsReview: true,
    };
  }

  return {
    title: metadata.title || detected.title,
    subtitle: metadata.subtitle,
    authors: metadata.authors.length > 0 ? metadata.authors : detected.authors,
    publisher: metadata.publisher ?? detected.publisher,
    publishedDate: metadata.publishedDate,
    isbn10: metadata.isbn10,
    isbn13: metadata.isbn13,
    pageCount: metadata.pageCount,
    categories: metadata.categories,
    description: metadata.description,
    language: metadata.language,
    coverUrl: metadata.coverUrl,
    confidence: detected.confidence,
    needsReview: lowConfidence,
  };
}

export async function processScan({
  userId,
  scanId,
  apiKey,
  fetchImpl = fetch,
}: ProcessScanOptions): Promise<ProcessScanResult> {
  const scan = await getScan(userId, scanId);
  if (!scan) {
    // Nothing to mark as failed -- the scan is not this user's, or is gone.
    return { status: "failed", detectedCount: 0, errorMessage: "找不到這次掃描。" };
  }

  await markScanProcessing(userId, scanId);

  let rawResult: string | undefined;

  try {
    const object = await getPhoto(scan.r2Key);
    if (!object) {
      throw new VisionError("api_error", `R2 object ${scan.r2Key} is missing.`);
    }

    const image = await object.arrayBuffer();
    const mediaType = object.httpMetadata?.contentType ?? "image/jpeg";

    const recognition = await recognizeBooks({ apiKey, image, mediaType, fetchImpl });
    rawResult = recognition.raw;

    let created = 0;
    for (const detected of recognition.books) {
      const metadata = await lookupBook({
        isbn: detected.isbn,
        title: detected.title,
        author: detected.authors[0] ?? null,
        fetchImpl,
      });

      const { created: wasCreated } = await createBookIfNew(userId, {
        ...mergeMetadata(detected, metadata),
        source: "vision",
        scanId,
      });
      if (wasCreated) created += 1;
    }

    await markScanDone(userId, scanId, { detectedCount: created, rawResult });
    return { status: "done", detectedCount: created };
  } catch (error) {
    const errorMessage =
      error instanceof VisionError
        ? VISION_ERROR_MESSAGES[error.code]
        : "辨識過程發生未預期的錯誤，請再試一次。";

    await markScanFailed(userId, scanId, {
      errorMessage,
      // Keep whatever the model actually sent so a bad reply can be inspected.
      rawResult: error instanceof VisionError ? (error.rawResult ?? rawResult ?? null) : null,
    });

    return { status: "failed", detectedCount: 0, errorMessage };
  }
}
