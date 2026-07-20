import type { KryptosAlgorithm } from "@lindorm/kryptos";
import { sanitiseToken } from "@lindorm/utils";
import { JweKit } from "../../classes/JweKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { AegisError } from "../../errors/index.js";
import type { ParsedJws, ParsedJwt, VerifyJwtOptions } from "../../types/index.js";
import type { AegisDeps } from "./aegis-deps.js";
import { coseVerifyCore } from "./cose-verify-core.js";
import { validateCwtClaims } from "./validate-cwt-claims.js";

/**
 * The profile-less domain verify pipeline (`aegis.verify(token)`): auto-detect
 * the format and verify. A JWE is decrypted and its inner token re-verified; a
 * COSE token is base64url CBOR with no JOSE dot structure — verify its integrity
 * (decrypting a COSE_Encrypt0 if needed) and return the domain claims. Like the
 * profile-less JWT path, no profile floor is applied. With no options it types
 * as a ParsedCws (raw COSE_Sign1); with verify options the standard claims are
 * validated exactly as jwt.verify validates a JWT, typing as a ParsedCwt.
 */
export const verifyToken = async <T extends ParsedJwt | ParsedJws<any>>({
  token,
  options,
  deps,
}: {
  token: string;
  options?: VerifyJwtOptions;
  deps: AegisDeps;
}): Promise<T> => {
  if (JwtKit.isJwt(token)) {
    return (await deps.verifyJwt(token, options)) as T;
  }
  if (JweKit.isJwe(token)) {
    const decrypt = await deps.decryptJwe(token);
    return await verifyToken<T>({ token: decrypt.payload, options, deps });
  }
  if (JwsKit.isJws(token)) {
    return (await deps.verifyJws(token)) as T;
  }

  if (!token.includes(".")) {
    const bytes = Buffer.from(token, "base64url");
    if (deps.coseKit.isCose(bytes)) {
      const { claims, wire, decoded } = await coseVerifyCore({ input: bytes, deps });
      if (options) {
        validateCwtClaims(
          wire,
          decoded.algorithm as KryptosAlgorithm,
          options,
          deps.clockTolerance,
        );
      }
      return {
        claims,
        header: { alg: decoded.algorithm, kid: decoded.kid, typ: decoded.typ },
        token,
      } as unknown as T;
    }
  }

  throw new AegisError("Invalid token type", {
    code: "unsupported_token_type",
    debug: { token: sanitiseToken(token) },
    title: "Unsupported Token Type",
    details:
      "The token is not a recognised JWT, JWE, JWS, or COSE token, so Aegis cannot select a kit to verify it.",
  });
};
