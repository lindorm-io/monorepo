import { Base64Encoding } from "../types";
import { _decode } from "./private/decode";
import { _encodeBase64, _encodeBase64Url } from "./private/encode";

export const B64 = {
  encode: (input: string, encoding: Base64Encoding = "base64"): string =>
    encoding === "base64" ? _encodeBase64(input) : _encodeBase64Url(input),
  decode: _decode,
};
