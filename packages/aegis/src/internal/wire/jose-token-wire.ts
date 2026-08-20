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
 * What the JOSE wire does with each kit option it is handed.
 *
 * Every row is `forwarded`, and the claim that carries is the literal one: the
 * option REACHES the kit through the rest-spread. The tables are typed over the
 * INTERSECTION of the two wires' kit option types because ONE input crosses to
 * both wires ({@link SignClaimsInput}) and neither type is wider on its own, so
 * the COSE-only members appear here too.
 *
 * ⚠ A ROW SPEAKS FOR A TOP-LEVEL KEY AND NOTHING BELOW IT, so `forwarded` does
 * not promise every MEMBER of a nested bag is read. Two rows here are the
 * `forwarded`-but-not-read cases, and the TYPE is what closes each rather than
 * this table:
 *
 *   - `proprietary` is a COSE interop gate the JOSE kits ignore.
 *   - `custom` is forwarded whole, and `buildJoseHeader` reads `custom.header`
 *     alone — compact serialisation has one header and it is protected
 *     (`KIT_CAPABILITIES.<jose kit>.unprotectedBucket: false`), so there is no
 *     `custom.unprotected` for it to read.
 *
 * ⛔ Neither is a silent drop a caller can reach: the PUBLIC JOSE doors
 * (`aegis.jwt|jws|jwe.*`, `JwtKit`, `JwsKit`, `JweKit`) take `Jose*` option types
 * that declare no `proprietary`, and whose `custom` bag declares only `header` —
 * so `custom.unprotected` AND `custom.protected` are both COMPILE errors, not
 * accepted-and-ignored requests. Pinned in `types/header/wire-envelope.test.ts`.
 * They arrive here only through the untyped internal seam, which is the one this
 * table cannot speak below.
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

  // What a JOSE outer declares over each nested token it can seal. Stamped
  // EXPLICITLY so it overrides the `text/plain` the codec would otherwise infer
  // from a compact token STRING; the read side uses it to reconstruct the
  // plaintext back to that string rather than to a text blob.
  nestedTokenCty: {
    // ⚠ THE LITERAL STRING, and it is not a style choice. RFC 7519 §5.2: "In the
    // case that nested signing or encryption is employed, this Header Parameter
    // MUST be present; in this case, the value MUST be "JWT", to indicate that a
    // Nested JWT is carried in this JWT." §5.2 goes on to RECOMMEND the uppercase
    // spelling for compatibility with legacy implementations. Do NOT "correct"
    // this to `application/jwt`.
    jwt: "JWT",
    // A JWS that is not a JWT, and a JWE, are both COMPACT JOSE OBJECTS and
    // nothing more — RFC 7515 §9.2.1 registers `application/jose` for exactly
    // that: it "can be used to indicate that the content is a JWS or JWE using
    // the JWS Compact Serialization or the JWE Compact Serialization". RFC 7515
    // §4.1.10 permits shortening it to `jose`; the full media type is the
    // conformant spelling and the one aegis writes. The read side accepts both.
    jws: "application/jose",
    jwe: "application/jose",
  },

  // ⚠ PRESERVED DIVERGENCE — see `TokenWire.nestedTokenTyp`. The JOSE outer has
  // never carried the inner's type; the mint passed one and the old hand-written
  // destructure did not name it.
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

    // The structural invariants a JWT must satisfy to be READ as one. They are
    // NOT signature checks — a keyless parse still has to refuse a token whose
    // own envelope is malformed, because everything downstream reads it as a JWT.
    assertWireTyp({
      typ: decoded.protectedHeader.typ,
      accept: ["JWT"],
      suffix: "+jwt",
      presence: "optional",
      error: JwtError,
      code: "jwt_invalid_typ",
      title: "JWT Invalid Typ",
      details:
        "Header typ is present but is not JWT or a <type>+jwt media type, so the token cannot be parsed as a JWT.",
    });

    // The header AS WRITTEN, not the typed bag alone — see `written-header.ts`.
    // `validateCrit` asks whether the header CARRIES what its `crit` names, and a
    // custom parameter lives in the other bag.
    const written = writtenHeader(decoded.protectedHeader, decoded.unknown.protected);

    const critError = validateCrit(written);
    if (critError) {
      throw new JwtError(`Invalid crit header: ${critError}`, {
        code: "jwt_invalid_crit",
        // ⚠ `written`, not the typed bag: the verdict was decided on the header AS
        // WRITTEN, so reporting `protectedHeader` can hand a consumer
        // `{ crit: undefined }` while the message names a member. The COSE twin
        // and `reject-unknown-critical.ts` report the same value.
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
      protectedHeader: decoded.protectedHeader,
      unprotectedHeader: {},
    };
  },

  verifyClaims: async ({ token, deps, options, crit, issuer }) => {
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
      protectedHeader: decoded.protectedHeader,
      unprotectedHeader: {},
      algorithm: kit.algorithm,
    };
  },

  verifyOpaque: async ({ token, deps, options, crit }) => {
    // ⚠ The per-call key POLICY threads through here. It used to be dropped on
    // this branch alone, so a caller stating an algorithm floor for an opaque
    // JOSE signature had that floor silently discarded — the worst kind of
    // policy, because the caller believes it is in force and stops checking.
    const verified = await rawVerifyJws({
      jws: token,
      options: { key: options.key, crit },
      deps,
    });

    return {
      format: "jws",
      payload: verified.payload,
      protectedHeader: verified.protectedHeader,
      unprotectedHeader: verified.unprotectedHeader,
    };
  },

  // ⚠ `format` is named only to keep it OUT of the spread — it is the COSE
  // structure selector and no JOSE kit takes one. Everything else the kits take
  // travels as `options`, so this call cannot drop a kit option by omission.
  signClaims: ({ kryptos, deps, common, format, ...options }) => {
    const wireClaims = domainToWire(common, joseName);

    const token = signJwt({ kryptos, deps, claims: wireClaims, options });

    return buildSignedToken(token, wireClaims, options.header?.oid, "jwt", joseName);
  },

  // DICT IN, DICT OUT. An object payload is handed to the kit AS AN OBJECT, so
  // the shared content codec infers `application/json` and `verify` reconstructs
  // the Dict the caller signed — the same contract `@lindorm/aes`
  // has always had, where `calculateContentType` maps an object to
  // `application/json` and the decrypt returns an object. A `string` stays
  // `text/plain` and a `Buffer` `application/octet-stream`; both are opaque and
  // round-trip unchanged. A caller-set `header.cty` still WINS as the wire label
  // (that is how a nested token declares itself, and `cty` is not reserved) —
  // `serialiseContent` takes it as an override. The COSE twin does the identical
  // thing one level down in `rawSignCose`, so the two wires now agree.
  //
  // Reached by `aegis.jws.sign` through the shared opaque entry
  // (`raw-sign-opaque.ts`), which runs `assertWireInput` over this wire's
  // `signOpaque` dispositions first. This is the package's only call site for
  // `rawSignJws`.
  //
  // The emission normalisation is NOT applied here. It lives in `rawSignJws`,
  // one level down, exactly where the COSE twin puts its own (`rawSignCose`);
  // applying it here as well would run it twice on the same payload. Its
  // behaviour is pinned by `sign-content-round-trip.test.ts`.
  signOpaque: ({ deps, payload, key, ...options }) =>
    rawSignJws({ data: payload, options: { ...options, key }, deps }),

  encryptContent: ({ kryptos, deps, content, ...options }) =>
    encryptJwe({
      kryptos,
      // The caller's own value, untouched: JweKit's codec states what it IS
      // (Dict→`application/json`, string→`text/plain`, Buffer→octet) and decrypt
      // reconstructs that same type back.
      data: content,
      // The whole kit option surface, including the ECDH-ES party info
      // (RFC 7518 §4.6) that JweKit gates and strips for every other algorithm,
      // and a nested token's `header.cty`, which the composition stamped.
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

    // The kit returns the WIRE header; the domain result carries the DOMAIN-named
    // one, so translate through the ONE `domainTokenHeader` (NOT a bare
    // `parseTokenHeader`) so `baseFormat` and the typ-derived `tokenType` are
    // stamped — a bare parse left `header.tokenType` permanently `undefined`.
    //
    // The unprotected bucket is EMPTY and always will be: RFC 7516 §7.1 gives the
    // JWE compact serialisation no syntax for one. It is stated rather than
    // omitted so both wires reach the merge through the same call.
    //
    // The plaintext is whatever the kit's codec reconstructed from the outer's
    // own cty, reported verbatim. Nothing is re-read here to decide whether the
    // value "is claims": a JWE's plaintext is the value its writer sealed.
    return {
      header: domainTokenHeader(
        { protectedHeader: decrypted.protectedHeader, unprotectedHeader: {} },
        "jwe",
      ),
      payload: decrypted.payload,
      token: decrypted.token,
    };
  },

  decodeToken: (token) => token,

  // A reconstructed object (a bare claims set) is not a token, so there is
  // nothing to hand back; a compact JOSE token IS its string.
  encodeToken: (content) => (isString(content) ? content : undefined),
};
