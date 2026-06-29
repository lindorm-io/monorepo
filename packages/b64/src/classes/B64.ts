import type { Base64Encoding } from "../types/index.js";
import { decode, encodeBytes } from "../internal/index.js";

export class B64 {
  static encode(input: Uint8Array | string, encoding: Base64Encoding = "base64"): string {
    return encodeBytes(input, encoding);
  }

  static decode(input: string, encoding?: Base64Encoding): string {
    return new TextDecoder().decode(decode(input, encoding));
  }

  static toBuffer(input: string, encoding?: Base64Encoding): Buffer {
    return Buffer.from(decode(input, encoding));
  }

  static toBytes(input: string, encoding?: Base64Encoding): Uint8Array {
    return decode(input, encoding);
  }

  static toString(input: string, encoding?: Base64Encoding): string {
    return new TextDecoder().decode(decode(input, encoding));
  }

  static isBase64(input: string): boolean {
    return /^[A-Za-z0-9+/]*={0,2}$/.test(input);
  }

  static isBase64Url(input: string): boolean {
    return /^[A-Za-z0-9-_]*={0,2}$/.test(input);
  }
}
