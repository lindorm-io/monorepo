import { AesError } from "../../../errors";
import { Encryption } from "../../../types";

export const calculateSecretLength = (encryption: Encryption): number => {
  switch (encryption) {
    case "aes-128-cbc":
    case "aes-128-gcm":
      return 16;

    case "aes-192-cbc":
    case "aes-192-gcm":
      return 24;

    case "aes-256-cbc":
    case "aes-256-gcm":
      return 32;

    default:
      throw new AesError("Unsupported encryption", { debug: { encryption } });
  }
};
