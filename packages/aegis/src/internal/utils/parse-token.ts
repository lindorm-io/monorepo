import { sanitiseToken } from "@lindorm/utils";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { AegisError } from "../../errors/index.js";
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
  throw new AegisError("Invalid token type", {
    code: "unsupported_token_type",
    debug: { token: sanitiseToken(token) },
    title: "Unsupported Token Type",
    details:
      "The token is not a recognised JWT or JWS, so Aegis cannot select a kit to parse it.",
  });
};
