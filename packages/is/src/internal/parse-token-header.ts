import { B64 } from "@lindorm/b64";
import type { Dict } from "@lindorm/types";
import { isObject } from "../utils/is-object.js";

/**
 * One segment of a compact JOSE token, base64url-decoded and JSON-parsed — or
 * `null` when it is absent, undecodable, not JSON, or JSON that is not an
 * OBJECT. Both segments this is used for are specified as JSON objects (the
 * protected header, RFC 7515 §4 / RFC 7516 §4; the JWT Claims Set, RFC 7519
 * §7.2 step 10), so anything else is simply not that segment.
 */
const parseSegment = (input: string, index: number): Dict | null => {
  try {
    const parsed: unknown = JSON.parse(B64.decode(input.split(".")[index], "base64url"));

    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/** The protected JOSE header — segment 0. Never throws. */
export const parseTokenHeader = (input: string): Dict | null => parseSegment(input, 0);

/**
 * The JWS payload as a claims set — segment 1. `null` for a payload that is
 * detached, opaque, or otherwise not a JSON object, which is exactly the
 * evidence that separates a JWT from a bare JWS. Never throws.
 */
export const parseTokenClaims = (input: string): Dict | null => parseSegment(input, 1);
