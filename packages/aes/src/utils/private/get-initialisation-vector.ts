import { randomBytes } from "crypto";
import { AesError } from "../../errors";
import { Encryption } from "../../types";

export const getInitialisationVector = (encryption: Encryption): Buffer => {
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
        description: "Algorithm does not support initialisation vector",
        debug: { encryption },
      });
  }
};
