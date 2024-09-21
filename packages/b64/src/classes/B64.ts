import { Base64Encoding } from "../types";
import { decode, encodeBase64, encodeBase64Url } from "../utils/private";

export class B64 {
  public static encode(
    input: Buffer | string,
    encoding: Base64Encoding = "base64",
  ): string {
    return encoding === "base64" || encoding === "b64"
      ? encodeBase64(input)
      : encodeBase64Url(input);
  }

  public static toBuffer(input: string, encoding?: Base64Encoding): Buffer {
    return decode(input, encoding);
  }

  public static toString(input: string, encoding?: Base64Encoding): string {
    return decode(input, encoding).toString();
  }
}
