/**
 * Book recognition through the Anthropic Messages API.
 *
 * Called with `fetch` rather than the SDK so the worker bundle carries no
 * Node-only dependencies. The model is forced to answer through a tool call,
 * which is what makes the reply a validated object instead of prose that
 * happens to contain JSON.
 */
import { arrayBufferToBase64 } from "./base64";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 8192;

/** The Messages API accepts these image types; HEIC is not among them. */
const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

/** Per-image ceiling enforced by the API, applied to the encoded payload. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Books below this confidence are flagged for the user to confirm. */
export const REVIEW_CONFIDENCE_THRESHOLD = 0.6;

const TOOL_NAME = "record_books";

const SYSTEM_PROMPT = `You identify books in photographs of bookshelves, stacks and piles.

A single photo usually contains MANY books. Work through the image
systematically and report every book you can identify, reading the text
printed on spines as well as on front covers. Books lying flat, stacked, or
photographed at an angle still count.

Rules:
- Report each distinct book exactly once.
- Transcribe titles and author names exactly as printed, including the
  original language and script. Do not translate them.
- If a field is not legible in the photo, use null. Never guess a publisher,
  never invent an ISBN, and never fill in a title you cannot actually read.
- "confidence" is your own estimate, from 0 to 1, that the title AND the
  authors you reported are both correct. Use a low value when a spine is
  blurred, partly hidden, or you are inferring the book from a fragment.
- If the photo contains no identifiable books, return an empty list.`;

const USER_PROMPT = "Identify every book in this photo and record them with the record_books tool.";

const TOOL_DEFINITION = {
  name: TOOL_NAME,
  description: "Record every book identified in the photograph.",
  input_schema: {
    type: "object",
    properties: {
      books: {
        type: "array",
        description: "One entry per distinct book visible in the photo.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Title as printed on the book." },
            authors: {
              type: "array",
              items: { type: "string" },
              description: "Author names as printed. Empty if none are legible.",
            },
            publisher: {
              type: ["string", "null"],
              description: "Publisher as printed, or null if not legible.",
            },
            isbn: {
              type: ["string", "null"],
              description: "ISBN if visibly printed on the book, otherwise null.",
            },
            confidence: {
              type: "number",
              description: "0-1 confidence that title and authors are both correct.",
            },
          },
          required: ["title", "authors", "publisher", "isbn", "confidence"],
        },
      },
    },
    required: ["books"],
  },
} as const;

export type DetectedBook = {
  title: string;
  authors: string[];
  publisher: string | null;
  isbn: string | null;
  confidence: number;
};

export type VisionErrorCode =
  | "unsupported_media_type"
  | "image_too_large"
  | "missing_api_key"
  | "api_error"
  | "invalid_response";

export class VisionError extends Error {
  readonly code: VisionErrorCode;
  /** The unparsed model reply, kept so a bad response can be inspected later. */
  readonly rawResult?: string;

  constructor(code: VisionErrorCode, message: string, rawResult?: string) {
    super(message);
    this.name = "VisionError";
    this.code = code;
    this.rawResult = rawResult;
  }
}

/** User-facing (Traditional Chinese) message for each failure mode. */
export const VISION_ERROR_MESSAGES: Record<VisionErrorCode, string> = {
  unsupported_media_type: "這種圖片格式無法辨識，請改用 JPEG、PNG 或 WebP。",
  image_too_large: "圖片太大，請縮小後再上傳。",
  missing_api_key: "伺服器尚未設定辨識服務的金鑰，請聯絡管理員。",
  api_error: "辨識服務暫時無法使用，請稍後再試一次。",
  invalid_response: "辨識服務回傳了無法解析的內容，請再試一次。",
};

type MessagesResponse = {
  stop_reason?: string;
  stop_details?: { category?: string | null; explanation?: string } | null;
  content?: { type: string; name?: string; input?: unknown; text?: string }[];
};

function isRetryableStatus(status: number): boolean {
  // 429 and 5xx are worth another attempt; 4xx are not going to change.
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normaliseBook(value: unknown): DetectedBook | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;

  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!title) return null;

  const authors = Array.isArray(record.authors)
    ? record.authors.filter((a): a is string => typeof a === "string" && a.trim().length > 0)
    : [];

  const publisher = typeof record.publisher === "string" ? record.publisher.trim() || null : null;
  const isbn =
    typeof record.isbn === "string" ? record.isbn.replace(/[^0-9Xx]/g, "") || null : null;

  const rawConfidence = typeof record.confidence === "number" ? record.confidence : 0;
  const confidence = Number.isFinite(rawConfidence) ? Math.min(1, Math.max(0, rawConfidence)) : 0;

  return { title, authors, publisher, isbn, confidence };
}

/**
 * Pulls the book list out of the response.
 *
 * The model is told to answer with a tool call, so a reply without one is a
 * failure -- but its text is preserved for debugging rather than discarded.
 */
function parseResponse(body: MessagesResponse, raw: string): DetectedBook[] {
  if (body.stop_reason === "refusal") {
    throw new VisionError("invalid_response", "The model declined to describe this image.", raw);
  }

  const toolUse = body.content?.find(
    (block) => block.type === "tool_use" && block.name === TOOL_NAME,
  );
  if (!toolUse) {
    throw new VisionError("invalid_response", "The model did not call the tool.", raw);
  }

  const input = toolUse.input as { books?: unknown } | undefined;
  if (!input || !Array.isArray(input.books)) {
    throw new VisionError("invalid_response", "The tool call had no book list.", raw);
  }

  return input.books.map(normaliseBook).filter((book): book is DetectedBook => book !== null);
}

export type RecognizeOptions = {
  apiKey: string | undefined;
  image: ArrayBuffer;
  mediaType: string;
  /** Injected by tests. */
  fetchImpl?: typeof fetch;
  /** Attempts after the first one. */
  retries?: number;
  /** Base delay for the exponential backoff, in ms. */
  retryDelayMs?: number;
};

export type RecognizeResult = {
  books: DetectedBook[];
  /** The raw response body, stored on the scan for debugging. */
  raw: string;
};

export async function recognizeBooks({
  apiKey,
  image,
  mediaType,
  fetchImpl = fetch,
  retries = 2,
  retryDelayMs = 500,
}: RecognizeOptions): Promise<RecognizeResult> {
  if (!apiKey) {
    throw new VisionError("missing_api_key", "ANTHROPIC_API_KEY is not configured.");
  }

  const normalisedType = mediaType.toLowerCase();
  if (!SUPPORTED_MEDIA_TYPES.includes(normalisedType as (typeof SUPPORTED_MEDIA_TYPES)[number])) {
    throw new VisionError("unsupported_media_type", `Unsupported image type: ${mediaType}`);
  }
  if (image.byteLength > MAX_IMAGE_BYTES) {
    throw new VisionError("image_too_large", `Image is ${image.byteLength} bytes.`);
  }

  const payload = JSON.stringify({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    // Forcing the tool is what makes the reply a structured object rather than
    // prose we would have to scrape JSON out of.
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: normalisedType,
              data: arrayBufferToBase64(image),
            },
          },
          { type: "text", text: USER_PROMPT },
        ],
      },
    ],
  });

  let lastError: VisionError | undefined;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      await sleep(retryDelayMs * 2 ** (attempt - 1));
    }

    let response: Response;
    try {
      response = await fetchImpl(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": API_VERSION,
        },
        body: payload,
      });
    } catch (cause) {
      lastError = new VisionError(
        "api_error",
        `Request to the Messages API failed: ${String(cause)}`,
      );
      continue;
    }

    const text = await response.text();

    if (!response.ok) {
      lastError = new VisionError(
        "api_error",
        `Messages API returned ${response.status}: ${text.slice(0, 500)}`,
        text,
      );
      if (isRetryableStatus(response.status)) continue;
      throw lastError;
    }

    let body: MessagesResponse;
    try {
      body = JSON.parse(text) as MessagesResponse;
    } catch {
      // Malformed JSON from a 200 will not fix itself on a retry.
      throw new VisionError("invalid_response", "The response body was not valid JSON.", text);
    }

    return { books: parseResponse(body, text), raw: text };
  }

  throw lastError ?? new VisionError("api_error", "The Messages API could not be reached.");
}
