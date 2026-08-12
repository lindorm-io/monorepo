import { isString } from "@lindorm/is";
import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import { JwtKit } from "../../classes/JwtKit.js";
import { JwtError } from "../../errors/index.js";
import type { TokenProfileTyp } from "../../types/index.js";
import { joseName } from "../claims/claims-registry.js";
import { domainToWire } from "../claims/translate.js";
import { buildSignedToken } from "../utils/build-signed-token.js";
import { computeTypHeader, extractTypPrefix } from "../utils/compute-typ-header.js";
import { domainHeaderToWire } from "../utils/domain-header-to-wire.js";
import { encryptJwe } from "../utils/encrypt-jwe.js";
import { rawDecryptJwe } from "../utils/raw-decrypt-jwe.js";
import { rawVerifyJws } from "../utils/raw-verify-jws.js";
import { validateCrit } from "../utils/validate-crit.js";
import type { TokenWire } from "./token-wire.js";

/**
 * Convert the wire's NumericDate temporal claims to `Date`s for the identity
 * matchers. The COSE claim codec already decodes them inside the kit, so this is
 * what puts both wires in the same shape before the shared matcher pass — and it
 * is deliberately NOT applied to the payload the result reports, which stays
 * exactly as the wire carried it.
 */
const withDates = (payload: Dict): Dict => ({
  ...payload,
  exp: payload.exp ? new Date((payload.exp as number) * 1000) : undefined,
  iat: payload.iat ? new Date((payload.iat as number) * 1000) : undefined,
  nbf: payload.nbf ? new Date((payload.nbf as number) * 1000) : undefined,
  auth_time: payload.auth_time
    ? new Date((payload.auth_time as number) * 1000)
    : undefined,
});

/** The JOSE wire: compact JWS/JWE serialisation, one integrity-protected header. */
export const JOSE_TOKEN_WIRE: TokenWire = {
  nameOf: joseName,

  // AEGIS POLICY, modelled on RFC 8725 §3.11, which says explicit typing is
  // RECOMMENDED for new uses of JWTs — a SHOULD, not a mandate. Its only MUST is
  // the inner typ of a NESTED JWT. Defaulting to required is our choice.
  defaultTypPresence: "required",

  // The JOSE claims read has always required a non-empty `iss`.
  issuerPresence: "required",

  encryptedFormat: "jwe",

  // A JWE's plaintext may be a nested claims token, an opaque JWS, or another
  // JWE — all three resolve today and all three stay.
  encryptedInner: ["jwt", "jws", "jwe"],

  profileTyp: (typ: TokenProfileTyp) => (typ.presence === "none" ? undefined : typ.value),

  // The profile's mandated type wins; then the caller's explicit one; then the
  // content's own tokenType, which floors to the bare `JWT` the kit requires.
  mintTypPrefix: ({ profile, contentTokenType, signTyp }) => {
    const full =
      profile.typ.presence !== "none"
        ? profile.typ.value
        : signTyp != null
          ? signTyp
          : computeTypHeader(contentTokenType, "jwt");

    return extractTypPrefix(full, "jwt");
  },

  assertedTyp: (tokenType) => computeTypHeader(tokenType, "jwt"),

  decodeClaims: (token) => {
    const decoded = JwtKit.decode(token);

    // The structural invariants a JWT must satisfy to be READ as one. They are
    // NOT signature checks — a keyless parse still has to refuse a token whose
    // own envelope is malformed, because everything downstream reads it as a JWT.
    const typ = decoded.protectedHeader.typ;
    if (typ !== undefined && typ !== "JWT" && !typ.endsWith("+jwt")) {
      throw new JwtError("Invalid token", {
        code: "jwt_invalid_typ",
        data: { typ },
        title: "JWT Invalid Typ",
        details:
          "Header typ is present but is not JWT or a <type>+jwt media type, so the token cannot be parsed as a JWT.",
      });
    }

    const critError = validateCrit(decoded.protectedHeader);
    if (critError) {
      throw new JwtError(`Invalid crit header: ${critError}`, {
        code: "jwt_invalid_crit",
        data: { crit: decoded.protectedHeader.crit },
        title: "JWT Invalid Crit",
        details:
          "The crit header is malformed; it must be a non-empty array of strings naming extension parameters present in the header.",
      });
    }

    return {
      format: "jwt",
      wire: decoded.payload,
      matcher: withDates(decoded.payload),
      protectedHeader: decoded.protectedHeader,
      unprotectedHeader: {},
    };
  },

  verifyClaims: async ({ token, deps, options, issuer }) => {
    const decoded = JwtKit.decode(token);

    // Verifier-declared issuer wins; else the token's own UNVERIFIED `iss`; else
    // unscoped. The unverified value is safe because the scope only ever NARROWS
    // the candidate keys — a lie produces a miss, never a wider search. The `iss`
    // claim itself is still checked, and only ever after the signature.
    const kryptos = await deps.resolveVerifyKey({
      id: decoded.protectedHeader.kid,
      algorithm: decoded.protectedHeader.alg as KryptosSigAlgorithm,
      issuer: issuer ?? (isString(decoded.payload.iss) ? decoded.payload.iss : undefined),
      verify: options.key,
    });

    const kit = new JwtKit({
      certBindingMode: deps.certBindingMode,
      clockTolerance: deps.clockTolerance,
      kryptos,
      logger: deps.logger,
    });

    kit.verify(token, undefined, {
      clockTolerance: options.clockTolerance,
      currentDate: options.currentDate,
      maxTokenAge: options.maxTokenAge,
      verifyExpiration: options.verifyExpiration,
      verifyNotBefore: options.verifyNotBefore,
      verifyIssuedAt: options.verifyIssuedAt,
      verifyAuthTime: options.verifyAuthTime,
    });

    return {
      format: "jwt",
      wire: decoded.payload,
      matcher: withDates(decoded.payload),
      protectedHeader: decoded.protectedHeader,
      unprotectedHeader: {},
      algorithm: kit.algorithm,
    };
  },

  verifyOpaque: async ({ token, deps, options }) => {
    // ⚠ The per-call key POLICY threads through here. It used to be dropped on
    // this branch alone, so a caller stating an algorithm floor for an opaque
    // JOSE signature had that floor silently discarded — the worst kind of
    // policy, because the caller believes it is in force and stops checking.
    const verified = await rawVerifyJws({
      jws: token,
      options: { key: options.key },
      deps,
    });

    return {
      format: "jws",
      payload: verified.payload,
      protectedHeader: verified.protectedHeader,
      unprotectedHeader: verified.unprotectedHeader,
    };
  },

  signClaims: ({
    kryptos,
    deps,
    common,
    tokenType,
    header,
    omit,
    bindCertificate,
    certificateThumbprintSha1,
  }) => {
    const wireClaims = domainToWire(common, joseName);

    const token = new JwtKit({
      certBindingMode: deps.certBindingMode,
      clockTolerance: deps.clockTolerance,
      kryptos,
      logger: deps.logger,
    }).sign(wireClaims, {
      bindCertificate,
      certificateThumbprintSha1:
        certificateThumbprintSha1 ?? deps.certificateThumbprintSha1,
      header: domainHeaderToWire(header),
      omit,
      tokenType,
    });

    return buildSignedToken(token, wireClaims, header?.objectId, "jwt", joseName);
  },

  encryptOuter: ({
    kryptos,
    deps,
    inner,
    partyProducer,
    partyRecipient,
    certificateThumbprintSha1,
  }) =>
    encryptJwe({
      kryptos,
      data: inner,
      // RFC 7519 §5.2 — the outer declares a nested JWT. Stamped EXPLICITLY so
      // caller-cty-wins overrides the string → text/plain inference the codec
      // would otherwise apply to the compact JWS string; the read side uses it to
      // reconstruct the plaintext to the inner token STRING.
      // The ECDH-ES party info (RFC 7518 §4.6) rides through from the encrypt
      // wrapper; JweKit gates and strips it, so it is inert for other algorithms.
      options: { header: { cty: "JWT" }, partyProducer, partyRecipient },
      defaultEncryption: deps.defaultEncryption,
      certBindingMode: deps.certBindingMode,
      certificateThumbprintSha1:
        certificateThumbprintSha1 ?? deps.certificateThumbprintSha1,
      logger: deps.logger,
    }),

  decryptOuter: async (token, deps) => {
    // The JWE outer resolves its recipient key UNSCOPED — the claims sit behind
    // that key, so no `iss` is readable yet. The signed inner IS scoped.
    const decrypted = await rawDecryptJwe({ jwe: token, deps });

    return {
      // A reconstructed object (a bare claims set, `cty: application/json`) or an
      // opaque Buffer is not a token, so there is nothing to hand back.
      inner: isString(decrypted.payload) ? decrypted.payload : undefined,
      contentType: decrypted.protectedHeader.cty,
    };
  },
};
