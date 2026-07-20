import type { KryptosAlgorithm } from "@lindorm/kryptos";
import { sanitiseToken } from "@lindorm/utils";
import { JweKit } from "../../classes/JweKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { AegisDomainError, AegisError } from "../../errors/index.js";
import type { ParsedJws, ParsedJwt, VerifyJwtOptions } from "../../types/index.js";
import { isCose } from "../cose/is-cose.js";
import type { AegisDeps } from "./aegis-deps.js";
import { coseVerifyCore } from "./cose-verify-core.js";
import { extractSensitiveClaims } from "./extract-sensitive-claims.js";
import { rawDecryptJwe } from "./raw-decrypt-jwe.js";
import { rawVerifyJws } from "./raw-verify-jws.js";
import { rawVerifyJwt } from "./raw-verify-jwt.js";
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
  encrypted = false,
}: {
  token: string;
  options?: VerifyJwtOptions;
  deps: AegisDeps;
  // True once an encrypting outer (jwe) has been peeled: the inner token was
  // delivered encrypted, so sensitive claims (OIDC Core §13.3) may surface.
  encrypted?: boolean;
}): Promise<T> => {
  if (JwtKit.isJwt(token)) {
    return (await rawVerifyJwt({ jwt: token, verify: options, deps, encrypted })) as T;
  }
  if (JweKit.isJwe(token)) {
    const decrypt = await rawDecryptJwe({ jwe: token, deps });
    return await verifyToken<T>({
      token: decrypt.payload,
      options,
      deps,
      encrypted: true,
    });
  }
  if (JwsKit.isJws(token)) {
    return (await rawVerifyJws({ jws: token, deps })) as T;
  }

  if (!token.includes(".")) {
    const bytes = Buffer.from(token, "base64url");
    if (isCose(bytes)) {
      const {
        claims: coseClaims,
        wire,
        decoded,
        encrypted: coseEncrypted,
      } = await coseVerifyCore({ input: bytes, deps });
      if (options) {
        validateCwtClaims(
          wire,
          decoded.algorithm as KryptosAlgorithm,
          options,
          deps.clockTolerance,
        );
      }
      // §13.3 gate: COSE carries sensitive claims FLAT (no bucket) — keep them
      // on an encrypted CWT (cwe), strip them on an unencrypted one.
      const claims = coseEncrypted ? coseClaims : extractSensitiveClaims(coseClaims).rest;
      return {
        claims,
        header: { alg: decoded.algorithm, kid: decoded.kid, typ: decoded.typ },
        token,
      } as unknown as T;
    }
  }

  // `verify` = authenticity: it ALWAYS requires a signature. When an encrypting
  // outer (jwe/cwe) has been peeled and the plaintext is NOT itself a signed
  // token (JWT/JWS/COSE_Sign1) — a bare/unsigned claims set — the token cannot be
  // sender-authenticated, so verify refuses it. Confidential-but-unsigned
  // encrypted claims are read with `aegis.decrypt`, never `verify`.
  if (encrypted) {
    throw new AegisDomainError("Encrypted token does not contain a signed inner token", {
      code: "verify_requires_signature",
      debug: { token: sanitiseToken(token) },
      title: "Verify Requires Signature",
      details:
        "aegis.verify requires sender authentication: a JWE/CWE must decrypt to a signed token (JWT, JWS, or COSE_Sign1). This encrypted token's plaintext is not signed — read confidential, unsigned encrypted claims with aegis.decrypt instead.",
    });
  }

  throw new AegisError("Invalid token type", {
    code: "unsupported_token_type",
    debug: { token: sanitiseToken(token) },
    title: "Unsupported Token Type",
    details:
      "The token is not a recognised JWT, JWE, JWS, or COSE token, so Aegis cannot select a kit to verify it.",
  });
};
