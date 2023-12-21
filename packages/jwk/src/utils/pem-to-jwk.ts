import { JwkError } from "../errors";
import { PemToJwkOptions, SpecificJwk } from "../types";
import { encodeEC } from "./private/ec";
import { encodeRSA } from "./private/rsa";

export const pemToJwk = ({ curve, privateKey, publicKey, type }: PemToJwkOptions): SpecificJwk => {
  switch (type) {
    case "EC":
      if (!curve) {
        throw new JwkError("Curve is required for EC keys");
      }
      return encodeEC({ curve, privateKey, publicKey });

    case "RSA":
      return encodeRSA({ privateKey, publicKey });

    default:
      throw new JwkError("Invalid KeyType");
  }
};
