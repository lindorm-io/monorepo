import type { KryptosAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { sanitiseToken } from "@lindorm/utils";
import { JweKit } from "../../classes/JweKit.js";
import { JwsKit } from "../../classes/JwsKit.js";
import { JwtKit } from "../../classes/JwtKit.js";
import { AegisDomainError, AegisError } from "../../errors/index.js";
import type { DomainAssert, VerifiedToken, VerifyOptions } from "../../types/index.js";
import { isCose } from "../cose/is-cose.js";
import { isCws as isCwsBytes } from "../cose/is-cose-format.js";
import type { AegisDeps } from "./aegis-deps.js";
import { buildCoseVerifiedToken, coseDomainHeader } from "./build-cose-verified-token.js";
import { coseVerifyCore } from "./cose-verify-core.js";
import { rawDecryptJwe } from "./raw-decrypt-jwe.js";
import { rawVerifyCws } from "./raw-verify-cws.js";
import { rawVerifyJws } from "./raw-verify-jws.js";
import { validateCwtClaims } from "./validate-cwt-claims.js";
import { verifyJwtToken } from "./verify-jwt.js";

/**
 * The profile-less domain verify pipeline (`aegis.verify(token)` → the unified
 * `VerifiedToken`): auto-detect the format and verify. A JWT/CWT/CWM resolves the
 * full domain `claims`/`custom` buckets; a JWS/CWS delivers its opaque `raw`
 * payload beside an empty domain; a JWE/CWE is decrypted and its SIGNED inner
 * re-verified (an unsigned inner ⇒ `verify_requires_signature`), the OUTER
 * `format` (`jwe`/`cwe`) reported with the inner format under `inner`.
 */
export const verifyToken = async <C extends Dict = Dict>({
  token,
  assert,
  options,
  deps,
  encrypted = false,
}: {
  token: string;
  assert?: DomainAssert;
  options?: VerifyOptions;
  deps: AegisDeps;
  // True once an encrypting outer (jwe/cwe) has been peeled: the inner token was
  // delivered encrypted, so sensitive claims (OIDC Core §13.3) may surface.
  encrypted?: boolean;
}): Promise<VerifiedToken<C>> => {
  if (JwtKit.isJwt(token)) {
    return verifyJwtToken<C>({ token, assert, options, deps, encrypted });
  }

  if (JweKit.isJwe(token)) {
    const decrypt = await rawDecryptJwe({ jwe: token, deps });
    const inner = await verifyToken<C>({
      token: decrypt.payload,
      assert,
      options,
      deps,
      encrypted: true,
    });
    // The OUTER wire is a JWE; the domain claims come from the verified signed
    // inner token, whose format is recorded under `inner`.
    return {
      ...inner,
      format: "jwe",
      inner: inner.format as VerifiedToken["inner"],
    };
  }

  if (JwsKit.isJws(token)) {
    const parsed = await rawVerifyJws({ jws: token, deps });
    return {
      format: "jws",
      header: parsed.header,
      claims: {},
      custom: {} as C,
      raw: parsed.payload,
      token,
    };
  }

  if (!token.includes(".")) {
    const bytes = Buffer.from(token, "base64url");

    // An opaque CWS is the COSE twin of a JWS: deliver its `raw` payload beside an
    // empty domain (no claim codec). Detected by the `+cws` typ before the claims
    // path so it is never mis-read as a CWT.
    if (isCwsBytes(bytes)) {
      const parsed = await rawVerifyCws({ token, options: { key: options?.key }, deps });
      return {
        format: "cws",
        header: coseDomainHeader(parsed.header),
        claims: {},
        custom: {} as C,
        raw: parsed.raw,
        token,
      };
    }

    if (isCose(bytes)) {
      const {
        wire,
        decoded,
        encrypted: coseEncrypted,
      } = await coseVerifyCore({
        input: bytes,
        deps,
      });
      if (options || assert) {
        validateCwtClaims(
          wire,
          decoded.algorithm as KryptosAlgorithm,
          assert,
          options ?? {},
          deps.clockTolerance,
        );
      }

      const verified = buildCoseVerifiedToken({
        wire,
        decoded,
        token,
        encrypted: coseEncrypted || encrypted,
      }) as VerifiedToken<C>;

      // A COSE_Encrypt0 (cwe) wrapped a signed inner CWT/CWM: report the OUTER
      // `cwe` format with the inner claims-format under `inner`.
      if (coseEncrypted) {
        return {
          ...verified,
          format: "cwe",
          inner: verified.format as VerifiedToken["inner"],
        };
      }

      return verified;
    }
  }

  // `verify` = authenticity: it ALWAYS requires a signature. When an encrypting
  // outer (jwe/cwe) has been peeled and the plaintext is NOT itself a signed
  // token — a bare/unsigned claims set — the token cannot be sender-authenticated,
  // so verify refuses it. Confidential-but-unsigned encrypted claims are read with
  // `aegis.decrypt`, never `verify`.
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
