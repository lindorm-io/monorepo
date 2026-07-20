import { sanitiseToken } from "@lindorm/utils";
import { JweKit } from "../../classes/JweKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { AegisDomainError, AegisError } from "../../errors/index.js";
import type { ParsedJws, ParsedJwt } from "../../types/index.js";
import { parseJwtToDomain } from "./parse-jwt.js";

/**
 * The keyless domain parse (`aegis.parse`): decode + domain-translate a JWT or
 * JWS without any signature check. A JWE/JWS distinction is made by the wire
 * structure; an unrecognised token throws.
 */
export const parseToken = <T extends ParsedJwt | ParsedJws<any>>(token: string): T => {
  if (JwtKit.isJwt(token)) {
    return parseJwtToDomain(token) as T;
  }
  if (JwsKit.isJws(token)) {
    return JwsKit.parse(token) as T;
  }
  // `parse` is keyless + unverified — it CANNOT read an encrypted token, whose
  // claims are unreadable without the decryption key. A JWE is rejected outright;
  // the caller must use `aegis.decrypt` (confidential) or `aegis.verify`
  // (sign-then-encrypt) instead.
  if (JweKit.isJwe(token)) {
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
