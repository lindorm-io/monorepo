import { B64 } from "@lindorm/b64";
import { isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { B64U } from "../../constants/format.js";
import type { InvalidEntry } from "../../../types/index.js";

const PERMITTED_MEMBERS = new Set(["jkt", "x5t#S256", "jwk", "kid", "jku"]);

// A base64url SHA-256 thumbprint decodes to exactly 32 bytes.
const JKT_BYTE_LENGTH = 32;

/**
 * RFC 7800 / RFC 9449 — when `cnf` is present it must be an object limited to
 * the permitted members, and `jkt` (when present) must be a base64url string
 * that decodes to a 32-byte SHA-256 thumbprint.
 */
export const cnfShape = (claims: Dict): Array<InvalidEntry> => {
  const value = claims.cnf;

  if (value === undefined) return [];

  if (!isObject(value)) {
    return [{ key: "cnf", message: "cnf must be an object" }];
  }

  const cnf = value;
  const invalid: Array<InvalidEntry> = [];

  for (const key of Object.keys(cnf)) {
    if (!PERMITTED_MEMBERS.has(key)) {
      invalid.push({ key: `cnf.${key}`, message: `Unknown cnf member "${key}"` });
    }
  }

  if (cnf.jkt !== undefined) {
    if (!isString(cnf.jkt)) {
      invalid.push({ key: "cnf.jkt", message: "cnf.jkt must be a string" });
    } else {
      try {
        if (B64.toBuffer(cnf.jkt, B64U).length !== JKT_BYTE_LENGTH) {
          invalid.push({
            key: "cnf.jkt",
            message: "cnf.jkt must be a base64url SHA-256 (32-byte) thumbprint",
          });
        }
      } catch {
        invalid.push({ key: "cnf.jkt", message: "cnf.jkt must be valid base64url" });
      }
    }
  }

  return invalid;
};
