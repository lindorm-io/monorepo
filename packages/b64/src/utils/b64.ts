import { Base64Encoding } from "../types";
import { _decode } from "./private/decode";
import { _encodeBase64, _encodeBase64Url } from "./private/encode";

export class B64 {
  public static buffer(input: string, encoding?: Base64Encoding): Buffer {
    return _decode(input, encoding);
  }

  public static decode(input: string, encoding?: Base64Encoding): string {
    return _decode(input, encoding).toString();
  }

  public static encode(input: Buffer | string, encoding: Base64Encoding = "base64"): string {
    return encoding === "base64" ? _encodeBase64(input) : _encodeBase64Url(input);
  }
}
