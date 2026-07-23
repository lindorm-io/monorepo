import type { Dict } from "@lindorm/types";
import { sanitiseToken } from "@lindorm/utils";
import { JweKit } from "../../classes/JweKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { AegisDomainError, AegisError } from "../../errors/index.js";
import type { ParsedToken } from "../../types/index.js";
import { isCose } from "../cose/is-cose.js";
import {
  isCwe as isCweBytes,
  isCwm as isCwmBytes,
  isCws as isCwsBytes,
  isCwt as isCwtBytes,
} from "../cose/is-cose-format.js";
import { parseCoseClaimsToDomain } from "./parse-cose-claims.js";
import { parseJwtToDomain } from "./parse-jwt.js";

const REQUIRES_CLAIMS_DETAILS =
  "An opaque JWS/CWS is a signed blob with no claims layer, so aegis.parse (a claims reader) has nothing to return. Read it with aegis.jws.verify / aegis.cws.verify.";

const REQUIRES_DECRYPT_DETAILS =
  "aegis.parse is keyless and unverified, so it cannot read a JWE/CWE — its claims are encrypted. Use aegis.decrypt to read confidential claims, or aegis.verify for a sign-then-encrypt token.";

/**
 * The keyless domain CLAIMS parse (`aegis.parse`): decode + domain-translate a
 * STRUCTURED token WITHOUT a key and WITHOUT a signature check. `parse` is
 * fundamentally a claims reader, so it handles ONLY the three claims-bearing
 * formats:
 *
 * - STRUCTURED (jwt / cwt / cwm): the domain header + the claims buckets.
 * - UNSTRUCTURED (jws / cws): REJECTED — an opaque signed token carries no claims
 *   layer, so parse throws `parse_requires_claims`. Use `aegis.jws.verify` /
 *   `aegis.cws.verify` to read it.
 * - ENCRYPTED (jwe / cwe): REJECTED — the content is ciphertext, unreadable
 *   without the decryption key, so parse throws `parse_requires_decrypt`. Use
 *   `aegis.decrypt` (confidential) or `aegis.verify` (sign-then-encrypt).
 *
 * A structured result is UNVERIFIED — nothing here proves authenticity (use
 * `aegis.verify`). An unrecognised token throws.
 */
export const parseToken = <C extends Dict = Dict>(token: string): ParsedToken<C> => {
  if (JwtKit.isJwt(token)) {
    return parseJwtToDomain<C>(token);
  }

  // `parse` reads CLAIMS — an opaque JWS is a signed blob with no claims layer,
  // so it is rejected outright; verify or decode it instead.
  if (JwsKit.isJws(token)) {
    throw new AegisDomainError("Cannot parse an opaque token", {
      code: "parse_requires_claims",
      debug: { token: sanitiseToken(token) },
      title: "Parse Requires Claims",
      details: REQUIRES_CLAIMS_DETAILS,
    });
  }

  // `parse` is keyless + unverified — it CANNOT read an encrypted token, whose
  // claims are ciphertext. A JWE is rejected outright; use `aegis.decrypt`.
  if (JweKit.isJwe(token)) {
    throw new AegisDomainError("Cannot parse an encrypted token", {
      code: "parse_requires_decrypt",
      debug: { token: sanitiseToken(token) },
      title: "Parse Requires Decrypt",
      details: REQUIRES_DECRYPT_DETAILS,
    });
  }

  // COSE never carries the JOSE dot delimiter, so a non-dotted token is decoded
  // as base64url CBOR and dispatched by its COSE structure/typ.
  if (!token.includes(".")) {
    const bytes = Buffer.from(token, "base64url");
    if (isCose(bytes)) {
      if (isCwtBytes(bytes) || isCwmBytes(bytes)) {
        return parseCoseClaimsToDomain<C>(token, bytes);
      }
      // A CWS (opaque COSE_Sign1/COSE_Mac0) carries no claims — same refusal as a JWS.
      if (isCwsBytes(bytes)) {
        throw new AegisDomainError("Cannot parse an opaque token", {
          code: "parse_requires_claims",
          debug: { token: sanitiseToken(token) },
          title: "Parse Requires Claims",
          details: REQUIRES_CLAIMS_DETAILS,
        });
      }
      // A CWE (COSE_Encrypt0) is encrypted — same refusal as a JWE.
      if (isCweBytes(bytes)) {
        throw new AegisDomainError("Cannot parse an encrypted token", {
          code: "parse_requires_decrypt",
          debug: { token: sanitiseToken(token) },
          title: "Parse Requires Decrypt",
          details: REQUIRES_DECRYPT_DETAILS,
        });
      }
    }
  }

  throw new AegisError("Invalid token type", {
    code: "unsupported_token_type",
    debug: { token: sanitiseToken(token) },
    title: "Unsupported Token Type",
    details:
      "The token is not a recognised JOSE (JWT/JWS/JWE) or COSE (CWT/CWM/CWS/CWE) token, so Aegis cannot parse it.",
  });
};
