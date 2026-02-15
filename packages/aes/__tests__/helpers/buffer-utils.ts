/**
 * Convert Buffer to Uint8Array (zero-copy view).
 */
export const toUint8Array = (buf: Buffer): Uint8Array =>
  new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

/**
 * Convert Uint8Array to Buffer (zero-copy view).
 */
export const toBuffer = (arr: Uint8Array): Buffer =>
  Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
