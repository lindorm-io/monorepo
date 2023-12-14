import { AesFormat } from "../../enums";
import { AesError } from "../../errors";
import { AesCipherFormat } from "../../types";

export const mapFormatToShort = (format: AesCipherFormat): string => {
  switch (format) {
    case AesFormat.BASE64:
      return "b64";

    case AesFormat.BASE64_URL:
      return "b64u";

    case AesFormat.HEX:
      return "hex";

    default:
      throw new AesError("Invalid AES format");
  }
};

export const mapShortToFormat = (short: string): AesFormat => {
  switch (short) {
    case "b64":
      return AesFormat.BASE64;

    case "b64u":
      return AesFormat.BASE64_URL;

    case "hex":
      return AesFormat.HEX;

    default:
      throw new AesError("Invalid AES format");
  }
};
