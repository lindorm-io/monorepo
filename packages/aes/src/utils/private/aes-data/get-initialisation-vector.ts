import { randomBytes } from "crypto";
import { AesError } from "../../../errors";
import { AesEncryption } from "../../../types";

export const _getInitialisationVector = (encryption: AesEncryption): Buffer => {
  switch (encryption) {
    case "aes-128-cbc":
    case "aes-192-cbc":
    case "aes-256-cbc":
      return randomBytes(16);

    case "aes-128-gcm":
    case "aes-192-gcm":
    case "aes-256-gcm":
      return randomBytes(12);

    default:
      throw new AesError("Unexpected algorithm", {
        debug: { encryption },
      });
  }
};
