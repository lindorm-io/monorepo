import {
  CoseError,
  CweError,
  CwmError,
  CwsError,
  CwtError,
  JoseError,
  JweError,
  JwsError,
  JwtError,
} from "../errors/index.js";

/**
 * The wire error a door refuses under, by the names `{wireError}` binds: a
 * family root, or a format's own leaf.
 */
export const WIRE_ERROR = {
  JOSE: JoseError,
  COSE: CoseError,
  JWT: JwtError,
  CWT: CwtError,
  CWM: CwmError,
  JWS: JwsError,
  CWS: CwsError,
  JWE: JweError,
  CWE: CweError,
} as const;

export type WireError = keyof typeof WIRE_ERROR;
