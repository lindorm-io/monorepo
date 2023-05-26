import { Buffer } from "buffer";

export const getFirst128BitsFromBuffer = (buffer: Buffer): string =>
  buffer.subarray(16).toString("base64");
