/**
 * Workers have no `Buffer`, so binary/base64 conversion goes through btoa.
 * String.fromCharCode is applied in chunks because spreading a multi-megabyte
 * array into one call overflows the argument stack.
 */
const CHUNK_SIZE = 0x8000;

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE));
  }
  return btoa(binary);
}
