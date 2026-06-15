import { B64 } from "@lindorm/b64";
import { isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { B64U } from "../../constants/format.js";
import type { InvalidEntry } from "../../../types/index.js";

// The common layer is DOMAIN-keyed: confirmation members are domain names,
// which map to the wire cnf members (thumbprint→jkt, mtlsCertThumbprint→
// x5t#S256, key→jwk, keyId→kid, jwkSetUri→jku).
const PERMITTED_MEMBERS = new Set([
  "thumbprint",
  "mtlsCertThumbprint",
  "key",
  "keyId",
  "jwkSetUri",
]);

// A base64url SHA-256 thumbprint decodes to exactly 32 bytes.
const JKT_BYTE_LENGTH = 32;

/**
 * RFC 7800 / RFC 9449 — when `confirmation` is present it must be an object
 * limited to the permitted members, and `thumbprint` (the JWK SHA-256
 * thumbprint, wire `jkt`) must be a base64url string decoding to 32 bytes.
 */
export const cnfShape = (claims: Dict): Array<InvalidEntry> => {
  const value = claims.confirmation;

  if (value === undefined) return [];

  if (!isObject(value)) {
    return [{ key: "confirmation", message: "confirmation (cnf) must be an object" }];
  }

  const cnf = value;
  const invalid: Array<InvalidEntry> = [];

  for (const key of Object.keys(cnf)) {
    if (!PERMITTED_MEMBERS.has(key)) {
      invalid.push({
        key: `confirmation.${key}`,
        message: `Unknown confirmation member "${key}"`,
      });
    }
  }

  if (cnf.thumbprint !== undefined) {
    if (!isString(cnf.thumbprint)) {
      invalid.push({
        key: "confirmation.thumbprint",
        message: "confirmation.thumbprint (cnf.jkt) must be a string",
      });
    } else {
      try {
        if (B64.toBuffer(cnf.thumbprint, B64U).length !== JKT_BYTE_LENGTH) {
          invalid.push({
            key: "confirmation.thumbprint",
            message:
              "confirmation.thumbprint (cnf.jkt) must be a base64url SHA-256 (32-byte) thumbprint",
          });
        }
      } catch {
        invalid.push({
          key: "confirmation.thumbprint",
          message: "confirmation.thumbprint (cnf.jkt) must be valid base64url",
        });
      }
    }
  }

  return invalid;
};
