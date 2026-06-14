import { isString, isUrlLike } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";

/**
 * `iss`, when present, must be a URI-shaped string (RFC 7519 §4.1.1 — a
 * StringOrURI; the platform always emits a URL issuer).
 */
export const issUri = (claims: Dict): Array<InvalidEntry> => {
  const iss = claims.iss;

  if (iss === undefined) return [];

  if (!isString(iss) || !isUrlLike(iss)) {
    return [{ key: "iss", message: "iss must be a URI" }];
  }

  return [];
};
