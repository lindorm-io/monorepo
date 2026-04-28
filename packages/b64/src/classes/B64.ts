import type { Base64Encoding } from "../types/index.js";
import { decode, encodeBytes } from "../internal/index.js";

export class B64 {
  public static encode(
    input: Uint8Array | string,
    encoding: Base64Encoding = "base64",
  ): string {
    return encodeBytes(input, encoding);
  }

  public static decode(input: string, encoding?: Base64Encoding): string {
    return new TextDecoder().decode(decode(input, encoding));
  }

  public static toBuffer(input: string, encoding?: Base64Encoding): Buffer {
    return Buffer.from(decode(input, encoding));
  }

  public static toBytes(input: string, encoding?: Base64Encoding): Uint8Array {
    return decode(input, encoding);
  }

  public static toString(input: string, encoding?: Base64Encoding): string {
    return new TextDecoder().decode(decode(input, encoding));
  }

  public static isBase64(input: string): boolean {
    return /^[A-Za-z0-9+/]*={0,2}$/.test(input);
  }

  public static isBase64Url(input: string): boolean {
    return /^[A-Za-z0-9-_]*={0,2}$/.test(input);
  }
}
