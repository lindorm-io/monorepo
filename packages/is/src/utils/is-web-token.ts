import { isJwe } from "./is-jwe.js";
import { isJws } from "./is-jws.js";

/**
 * Is this a JOSE compact token of either family — the JWS Compact Serialization
 * (RFC 7515 §7.1) or the JWE Compact Serialization (RFC 7516 §7.1)?
 *
 * The umbrella over `isJws` and `isJwe`, and therefore over `isJwt` too, since a
 * JWT is a JWS. Decided by the wire grammar and the REQUIRED header parameters,
 * never by `typ` — both RFCs make it optional.
 */
export const isWebToken = (input: any): input is string => isJws(input) || isJwe(input);
