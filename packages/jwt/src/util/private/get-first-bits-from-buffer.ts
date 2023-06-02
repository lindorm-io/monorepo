import { Buffer } from "buffer";

export const getFirstBitsFromBuffer = (buffer: Buffer, bits: number): string =>
  buffer.subarray(0, bits / 8).toString("base64url");
