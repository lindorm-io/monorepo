import { isString } from "@lindorm/is";
import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { JwtKit } from "../../classes/JwtKit.js";
import { JwtError } from "../../errors/index.js";
import type { TokenContent, TokenProfileTyp } from "../../types/index.js";
import { joseName } from "../claims/claims-registry.js";
import { domainToWire } from "../claims/translate.js";
import { assertWireTyp } from "../utils/assert-wire-typ.js";
import { buildSignedToken } from "../utils/build-signed-token.js";
import { computeTypHeader, extractTypPrefix } from "../utils/compute-typ-header.js";
import { domainTokenHeader } from "../utils/domain-header.js";
import { encryptJwe } from "../utils/encrypt-jwe.js";
import { withJoseDates } from "../utils/jose-dates.js";
import { rawDecryptJwe } from "../utils/raw-decrypt-jwe.js";
import { rawSignJws } from "../utils/raw-sign-jws.js";
import { rawVerifyJws } from "../utils/raw-verify-jws.js";
import { signJwt } from "../utils/sign-jwt.js";
import { validateCrit } from "../utils/validate-crit.js";
import { writtenHeader } from "../header/written-header.js";
import type { TokenWire, WireInputDispositions } from "./token-wire.js";

/**
 * What the JOSE wire does with each kit option it is handed. Typed over the
 * INTERSECTION of the two wires' kit option types, so the COSE-only members appear
 * here too ({@link SignClaimsInput}).
 *
 * ⚠ A ROW SPEAKS FOR A TOP-LEVEL KEY AND NOTHING BELOW IT. `proprietary`
 * is a COSE interop gate the JOSE kits ignore, and `buildJoseHeader` reads
 * `custom.header` alone. Neither is a silent drop a caller can reach — the JOSE doors take
 * `Jose*` option types where both are COMPILE errors (pinned in
 * `types/header/wire-envelope.test.ts`); they arrive only through the untyped seam.
 */
const JOSE_DISPOSITIONS: WireInputDispositions = {
  signClaims: {
    header: { use: "forwarded" },
    custom: { use: "forwarded" },
    tokenType: { use: "forwarded" },
    bindCertificate: { use: "forwarded" },
    proprietary: { use: "forwarded" },
  },

  signOpaque: {
    header: { use: "forwarded" },
    custom: { use: "forwarded" },
    tokenType: { use: "forwarded" },
    bindCertificate: { use: "forwarded" },
    proprietary: { use: "forwarded" },
  },

  encryptContent: {
    header: { use: "forwarded" },
    custom: { use: "forwarded" },
    tokenType: { use: "forwarded" },
    bindCertificate: { use: "forwarded" },
    proprietary: { use: "forwarded" },
    partyProducer: { use: "forwarded" },
    partyRecipient: { use: "forwarded" },
  },

  decrypt: {
    // The read-side `crit` declaration reaches the kit's own decrypt door, which
    // is where the crit gate runs — `JweKit.decrypt` through
    // `assert-protected-header-gates.ts`, `CweKit.decrypt` directly.
    crit: { use: "forwarded" },
  },
};

/** The JOSE wire: compact JWS/JWE serialisation, one integrity-protected header. */
export const JOSE_TOKEN_WIRE: TokenWire = {
  dispositions: JOSE_DISPOSITIONS,

  nameOf: joseName,

  // AEGIS POLICY, modelled on RFC 8725 §3.11. Defaulting to required is our choice.
  defaultTypPresence: "required",

  // See the note on `TokenWire.issuerPresence`.
  issuerPresence: "required",

  encryptedFormat: "jwe",

  // A JWE's plaintext may be a nested claims token, an opaque JWS, or another JWE.
  encryptedInner: ["jwt", "jws", "jwe"],

  // What a JOSE outer declares over each nested token it can seal. Stamped
  // EXPLICITLY so it overrides the `text/plain` the codec would infer from a compact
  // token STRING, and the read side reconstructs the plaintext back to that string.
  nestedTokenCty: {
    // ⚠ THE LITERAL STRING, not a style choice — do NOT "correct" it to
    // `application/jwt`. RFC 7519 §5.2.
    jwt: "JWT",
    // A JWS that is not a JWT, and a JWE, are both compact JOSE objects
    // (RFC 7515 §9.2.1). aegis writes the full media type; the read side also
    // accepts the shortened `jose` (RFC 7515 §4.1.10).
    jws: "application/jose",
    jwe: "application/jose",
  },

  // ⚠ The JOSE outer carries no inner type — see `TokenWire.nestedTokenTyp`.
  nestedTokenTyp: "none",

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

    // A keyless parse checks no signature but still refuses a malformed envelope,
    // because everything downstream reads the result as a JWT.
    assertWireTyp({
      typ: decoded.header.typ,
      accept: ["JWT"],
      suffix: "+jwt",
      presence: "optional",
      error: JwtError,
      code: "jwt_invalid_typ",
      title: "JWT Invalid Typ",
      details:
        "Header typ is present but is not JWT or a <type>+jwt media type, so the token cannot be parsed as a JWT.",
    });

    // The header AS WRITTEN, not the typed bag alone (`written-header.ts`):
    // `validateCrit` asks whether the header CARRIES what its `crit` names, and a
    // custom parameter lives in the other bag.
    const written = writtenHeader(decoded.header, decoded.custom.header);

    const critError = validateCrit(written);
    if (critError) {
      throw new JwtError(`Invalid crit header: ${critError}`, {
        code: "jwt_invalid_crit",
        // ⚠ `written`, not the typed bag — the verdict is decided on the header AS
        // WRITTEN, so reporting `header` could hand a consumer `{ crit: undefined }`
        // while the message names a member. Same value the COSE twin reports.
        data: { crit: written.crit },
        title: "JWT Invalid Crit",
        details:
          "The crit header is malformed; it must be a non-empty array of strings naming extension parameters present in the header.",
      });
    }

    return {
      format: "jwt",
      wire: decoded.payload,
      matcher: withJoseDates(decoded.payload),
      protectedHeader: decoded.header,
      // The seam carries the COSE bucket pair, so the JOSE arms state the `{}`
      // compact serialisation yields — `KIT_CAPABILITIES.jwt`/`.jws`/`.jwe` all
      // declare `unprotectedBucket: false`.
      unprotectedHeader: {},
    };
  },

  verifyClaims: async ({ token, deps, options, crit, issuer }) => {
    const decoded = JwtKit.decode(token);

    // Verifier-declared issuer wins; else the token's own UNVERIFIED `iss`; else
    // unscoped. The unverified value only ever NARROWS the candidate keys, so a lie
    // produces a miss rather than a wider search; the `iss` claim itself is still
    // checked, after the signature.
    const kryptos = await deps.resolveVerifyKey({
      id: decoded.header.kid,
      algorithm: decoded.header.alg as KryptosSigAlgorithm,
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
      crit,
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
      matcher: withJoseDates(decoded.payload),
      protectedHeader: decoded.header,
      unprotectedHeader: {},
      algorithm: kit.algorithm,
    };
  },

  verifyOpaque: async ({ token, deps, options, crit }) => {
    // ⚠ The per-call key POLICY threads through here. Dropping it would silently
    // discard a caller's algorithm floor for an opaque JOSE signature.
    const verified = await rawVerifyJws({
      jws: token,
      options: { key: options.key, crit },
      deps,
    });

    return {
      format: "jws",
      payload: verified.payload,
      protectedHeader: verified.header,
      unprotectedHeader: {},
    };
  },

  // ⚠ `format` is named only to keep it OUT of the spread — it is the COSE structure
  // selector and no JOSE kit takes one. Everything else travels as `options`.
  signClaims: ({ kryptos, deps, common, format, ...options }) => {
    const wireClaims = domainToWire(common, joseName);

    const token = signJwt({ kryptos, deps, claims: wireClaims, options });

    return buildSignedToken(token, wireClaims, options.header?.oid, "jwt", joseName);
  },

  // DICT IN, DICT OUT. An object payload reaches the kit AS AN OBJECT, so the shared
  // content codec infers `application/json` and `verify` reconstructs the Dict the
  // caller signed; a caller-set `header.cty` still WINS as the wire label, which is
  // how a nested token declares itself.
  //
  // Reached by `aegis.jws.sign` through the shared opaque entry
  // (`raw-sign-opaque.ts`), which runs `assertWireInput` over this wire's
  // `signOpaque` dispositions first.
  //
  // ⚠ The emission normalisation is NOT applied here — it lives one level down in
  // `rawSignJws`, where the COSE twin puts its own, so applying it here as well
  // would run it twice on the same payload.
  signOpaque: ({ deps, payload, key, ...options }) =>
    rawSignJws({ data: payload, options: { ...options, key }, deps }),

  encryptContent: ({ kryptos, deps, content, ...options }) =>
    encryptJwe({
      kryptos,
      // The caller's own value, untouched: JweKit's codec states what it IS and
      // decrypt reconstructs that same type back.
      data: content,
      // The whole kit option surface, including the ECDH-ES party info
      // (RFC 7518 §4.6) and a nested token's `header.cty`.
      options,
      defaultEncryption: deps.defaultEncryption,
      certBindingMode: deps.certBindingMode,
      logger: deps.logger,
    }),

  decrypt: async ({ token, deps, key, crit }) => {
    // The JWE outer resolves its recipient key UNSCOPED — the claims sit behind
    // that key, so no `iss` is readable yet. The signed inner IS scoped.
    const decrypted = await rawDecryptJwe<TokenContent>({
      jwe: token,
      options: { key, crit },
      deps,
    });

    // The kit returns the WIRE header, so translate through the ONE
    // `domainTokenHeader` (NOT a bare `parseTokenHeader`) — that is what stamps
    // `baseFormat` and the typ-derived `tokenType`.
    //
    // The unprotected bucket is EMPTY (RFC 7516 §7.1), stated rather than omitted so
    // both wires reach the merge through the same call. The plaintext is whatever
    // the kit's codec reconstructed from the outer's own cty, reported verbatim.
    return {
      header: domainTokenHeader(
        { protectedHeader: decrypted.header, unprotectedHeader: {} },
        "jwe",
      ),
      payload: decrypted.payload,
      token: decrypted.token,
    };
  },

  decodeToken: (token) => token,

  // A reconstructed object is not a token; a compact JOSE token IS its string.
  encodeToken: (content) => (isString(content) ? content : undefined),
};
