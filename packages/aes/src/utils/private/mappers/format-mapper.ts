import { AesFormat } from "../../../enums";
import { AesError } from "../../../errors";

export const mapStringToAesFormat = (short: string): AesFormat => {
  switch (short) {
    case "base64":
      return AesFormat.BASE64;

    case "base64url":
      return AesFormat.BASE64_URL;

    case "hex":
      return AesFormat.HEX;

    default:
      throw new AesError("Invalid AES format");
  }
};
