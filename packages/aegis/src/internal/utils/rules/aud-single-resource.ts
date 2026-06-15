import { isArray, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";

/**
 * RFC 9068 + ADR-0014 — an access token's `aud` resolves to exactly one
 * resource URI (emitted as an array-of-one on the wire). Rejects a missing,
 * empty, or multi-element audience.
 */
export const audSingleResource = (claims: Dict): Array<InvalidEntry> => {
  const aud = claims.audience;

  if (aud === undefined) return [];

  if (isString(aud)) return [];

  if (!isArray(aud) || aud.length !== 1) {
    return [
      {
        key: "aud",
        message: "Access token aud must resolve to exactly one resource",
      },
    ];
  }

  return [];
};
