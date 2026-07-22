import type { Dict } from "@lindorm/types";
import { sanitiseToken } from "@lindorm/utils";
import { JweKit } from "../../classes/JweKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { AegisDomainError, AegisError } from "../../errors/index.js";
import type { ParsedToken } from "../../types/index.js";
import { isEncryptedCose } from "../cose/cose-encryption.js";
import { isCose } from "../cose/is-cose.js";
import { parseJwtToDomain } from "./parse-jwt.js";

// Is this an encrypted COSE token (a CWE)? Cheap dot-guard, then the CBOR probe.
const isEncryptedCoseToken = (token: string): boolean => {
  if (token.includes(".")) return false;
  const bytes = Buffer.from(token, "base64url");
  return isCose(bytes) && isEncryptedCose(bytes);
};

/**
 * The keyless domain parse (`aegis.parse`): decode + domain-translate a JWT or
 * JWS into the unified {@link ParsedToken} WITHOUT any signature check. An
 * encrypted token — a JWE or a CWE (COSE_Encrypt0) — is REJECTED: its claims are
 * unreadable without the decryption key (`parse_requires_decrypt`). An
 * unrecognised token throws. The result is UNVERIFIED — no `dpop` (a verify-only
 * field) is ever populated here.
 */
export const parseToken = <C extends Dict = Dict>(token: string): ParsedToken<C> => {
  if (JwtKit.isJwt(token)) {
    return parseJwtToDomain<C>(token);
  }

  if (JwsKit.isJws(token)) {
    const parsed = JwsKit.parse(token);
    return {
      format: "jws",
      header: parsed.header,
      claims: {},
      custom: {} as C,
      raw: parsed.payload,
      token,
    };
  }

  // `parse` is keyless + unverified — it CANNOT read an encrypted token, whose
  // claims are unreadable without the decryption key. A JWE and a CWE are both
  // rejected outright; the caller must use `aegis.decrypt` (confidential) or
  // `aegis.verify` (sign-then-encrypt) instead.
  if (JweKit.isJwe(token) || isEncryptedCoseToken(token)) {
    throw new AegisDomainError("Cannot parse an encrypted token", {
      code: "parse_requires_decrypt",
      debug: { token: sanitiseToken(token) },
      title: "Parse Requires Decrypt",
      details:
        "aegis.parse is keyless and unverified, so it cannot read a JWE/CWE — its claims are encrypted. Use aegis.decrypt to read confidential claims, or aegis.verify for a sign-then-encrypt token.",
    });
  }

  throw new AegisError("Invalid token type", {
    code: "unsupported_token_type",
    debug: { token: sanitiseToken(token) },
    title: "Unsupported Token Type",
    details:
      "The token is not a recognised JWT or JWS, so Aegis cannot select a kit to parse it.",
  });
};
