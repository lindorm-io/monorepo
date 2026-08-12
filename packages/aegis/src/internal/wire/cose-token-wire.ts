import { isString } from "@lindorm/is";
import type { KryptosAlgorithm } from "@lindorm/kryptos";
import { CwmKit } from "../../classes/CwmKit.js";
import { CwtKit } from "../../classes/CwtKit.js";
import type { TokenFormatTag, TokenProfileTyp } from "../../types/index.js";
import { coseName } from "../claims/claims-registry.js";
import { domainToWire } from "../claims/translate.js";
import { Tag } from "../cose/cbor.js";
import { selectCoseClaimsKit } from "../cose/cose-claims-kit.js";
import {
  decodeEncryptedCoseKid,
  decryptCose,
  encryptCose,
} from "../cose/cose-encryption.js";
import { coseTyp } from "../cose/cose-typ.js";
import { coseCty } from "../cose/is-cose-format.js";
import { COSE_TAG } from "../cose/structures.js";
import { decodeCwt, decodeCwtWire } from "../cose/cwt-token.js";
import { rawVerifyCws } from "../utils/raw-verify-cws.js";
import { buildSignedToken } from "../utils/build-signed-token.js";
import { computeTypHeader, extractTypPrefix } from "../utils/compute-typ-header.js";
import { domainHeaderToWire } from "../utils/domain-header-to-wire.js";
import type { TokenWire } from "./token-wire.js";

/**
 * The COSE structure tag decides `cwt` vs `cwm` on READ: a COSE_Sign1 (tag 18,
 * asymmetric) is a `cwt`, a COSE_Mac0 (tag 17, symmetric) a `cwm`. The inner tag,
 * with the outer CWT tag 61 already stripped by the decoder.
 */
const coseFormatOf = (cose: unknown): TokenFormatTag =>
  cose instanceof Tag && cose.tag === COSE_TAG.mac0 ? "cwm" : "cwt";

/** The COSE wire: RFC 9052 structures, a protected and an unprotected bucket. */
export const COSE_TOKEN_WIRE: TokenWire = {
  nameOf: coseName,

  // RFC 9596 leaves the COSE `typ` (label 16) optional, so a conformant foreign
  // CWT may carry none and a presence default of "required" would refuse it.
  defaultTypPresence: "optional",

  // The COSE claims read has never required an `iss`, and nothing yet says it
  // should — see the note on `TokenWire.issuerPresence`.
  issuerPresence: "optional",

  encryptedFormat: "cwe",

  // A COSE_Encrypt0 over an opaque CWS has never been readable here (the claims
  // decoder refuses the `+cws` media type), so admitting one would be a new
  // capability rather than a repair.
  encryptedInner: ["cwt", "cwm"],

  profileTyp: (typ: TokenProfileTyp) => coseTyp(typ),

  // ⚠ The profile, and only the profile. A caller's explicit `typ` and the
  // content's own `tokenType` have never reached the COSE mint; that gap is
  // recorded, not closed here.
  mintTypPrefix: ({ profile, format }) => extractTypPrefix(coseTyp(profile.typ), format),

  assertedTyp: (tokenType) =>
    coseTyp({ presence: "required", value: computeTypHeader(tokenType, "jwt") }),

  decodeClaims: (token) => {
    const bytes = Buffer.from(token, "base64url");
    const decoded = decodeCwt(bytes);
    const { payload, protectedHeader, unprotectedHeader } = decodeCwtWire(bytes);

    return {
      format: coseFormatOf(decoded.cose),
      // The COSE claim codec decodes temporal claims to `Date`s inside the kit,
      // so the wire payload and the matcher payload are the same object here.
      wire: payload,
      matcher: payload,
      protectedHeader,
      unprotectedHeader,
    };
  },

  verifyClaims: async ({ token, deps, options, issuer }) => {
    const bytes = Buffer.from(token, "base64url");
    const decoded = decodeCwt(bytes);

    // Verifier-declared issuer wins; else the CWT's own UNVERIFIED `iss` (a
    // COSE_Sign1/Mac0 payload is cleartext CBOR); else unscoped. Narrowing only —
    // the same contract the JOSE path uses.
    const kryptos = await deps.resolveVerifyKey({
      id: decoded.kid,
      algorithm: undefined,
      issuer:
        issuer ?? (isString(decoded.payload?.iss) ? decoded.payload.iss : undefined),
      verify: options.key,
    });

    const clockTolerance = options.clockTolerance ?? deps.clockTolerance;

    const { payload, protectedHeader, unprotectedHeader } = selectCoseClaimsKit({
      kryptos,
      logger: deps.logger,
      clockTolerance,
    }).verify(bytes, undefined, {
      clockTolerance,
      currentDate: options.currentDate,
      maxTokenAge: options.maxTokenAge,
      verifyExpiration: options.verifyExpiration,
      verifyNotBefore: options.verifyNotBefore,
      verifyIssuedAt: options.verifyIssuedAt,
      verifyAuthTime: options.verifyAuthTime,
    });

    return {
      format: coseFormatOf(decoded.cose),
      wire: payload,
      matcher: payload,
      protectedHeader,
      unprotectedHeader,
      // The protected-header alg the kit has already refused to accept unless it
      // equals the resolved key's own (`cwt_algorithm_mismatch` /
      // `cwm_algorithm_mismatch`) — the COSE twin of the JOSE cross-check.
      algorithm: decoded.algorithm as KryptosAlgorithm,
    };
  },

  verifyOpaque: async ({ token, deps, options }) => {
    const verified = await rawVerifyCws({ token, options: { key: options.key }, deps });

    return {
      format: "cws",
      payload: verified.payload,
      protectedHeader: verified.protectedHeader,
      unprotectedHeader: verified.unprotectedHeader,
    };
  },

  // The WRITE side selects the kit by the explicit FORMAT, not by the resolved
  // key's class: the kit's own class gate is then the backstop, so `format: "cwt"`
  // with a symmetric key throws instead of silently MAC-ing.
  signClaims: ({
    kryptos,
    deps,
    common,
    tokenType,
    header,
    omit,
    proprietary,
    format,
  }) => {
    const wireClaims = domainToWire(common, coseName);

    const kit =
      format === "cwm"
        ? new CwmKit({ kryptos, logger: deps.logger })
        : new CwtKit({ kryptos, logger: deps.logger });

    const token = kit.sign(wireClaims, {
      header: domainHeaderToWire(header),
      omit,
      proprietary,
      tokenType,
    });

    return buildSignedToken(
      token.toString("base64url"),
      wireClaims,
      header?.objectId,
      format === "cwm" ? "cwm" : "cwt",
      coseName,
    );
  },

  // The outer COSE_Encrypt0's typ is cosmetic — the read path decrypts, then
  // verifies the inner token — so it carries the same profile prefix. Its `cty`
  // (label 3) is stamped `application/cwt` (RFC 8392, mirroring the JOSE
  // `cty: JWT`) so the read side reconstructs the plaintext to the inner token
  // BYTES rather than the inferred octet blob.
  encryptOuter: ({ kryptos, deps, inner, tokenType, proprietary }) =>
    encryptCose({
      kryptos,
      logger: deps.logger,
      inner: Buffer.from(inner, "base64url"),
      tokenType,
      cty: "application/cwt",
      defaultEncryption: deps.defaultEncryption,
      proprietary,
    }).toString("base64url"),

  decryptOuter: async (token, deps) => {
    const bytes = Buffer.from(token, "base64url");

    // The CWE (COSE_Encrypt0) outer resolves UNSCOPED — its claims sit behind the
    // very key being resolved, exactly as for the outer JWE. The signed inner
    // CWT/CWM below IS scoped.
    const kryptos = await deps.resolveDecryptKey(
      decodeEncryptedCoseKid(bytes),
      undefined,
    );

    return {
      inner: decryptCose({ kryptos, logger: deps.logger, token: bytes }).toString(
        "base64url",
      ),
      contentType: coseCty(bytes),
    };
  },
};
