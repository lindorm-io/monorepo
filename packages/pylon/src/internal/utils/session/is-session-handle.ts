import { isString } from "@lindorm/is";
import type { PylonSessionHandle } from "../../../interfaces/index.js";

/**
 * The session cookie's SHAPE check, run on both read paths (HTTP request and
 * socket handshake) before the handle is used.
 *
 * A cookie that decrypts to anything else is not a handle this deployment wrote:
 * a session established under the pre-handle scheme carried a bare id STRING, and
 * a truncated or hand-edited value can decode to anything. Neither is an error to
 * report — both are simply "no session", and the caller clears the cookie.
 */
export const isSessionHandle = (value: unknown): value is PylonSessionHandle =>
  Boolean(value) &&
  isString((value as PylonSessionHandle).id) &&
  isString((value as PylonSessionHandle).sec);
