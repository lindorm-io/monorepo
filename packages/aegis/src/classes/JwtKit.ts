import type { Condition } from "@lindorm/match";
import { B64 } from "@lindorm/b64";
import { isJwt as isJwtFormat } from "@lindorm/is";
import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { sanitiseToken } from "@lindorm/utils";
import { JwtError } from "../errors/index.js";
import type { IJwtKit } from "../interfaces/index.js";
import { B64U } from "../internal/constants/format.js";
import { normaliseClaims } from "../internal/utils/normalise-claims.js";
import { assertKidMatch } from "../internal/utils/assert-kid-match.js";
import { assertTokenTypeMatch } from "../internal/utils/assert-token-type-match.js";
import { assertWireTyp } from "../internal/utils/assert-wire-typ.js";
import { buildJoseHeader } from "../internal/header/build-jose-header.js";
import { KIT_CAPABILITIES } from "../internal/registry/kit-capabilities.js";
import { buildMediaType } from "../internal/utils/compute-typ-header.js";
import { isSupportedJoseAlgorithm } from "../internal/utils/is-supported-jose-algorithm.js";
import { withJoseDates } from "../internal/utils/jose-dates.js";
import { decodeJoseHeader, encodeJoseHeader } from "../internal/utils/jose-header.js";
import {
  createJoseSignature,
  verifyJoseSignature,
} from "../internal/utils/jose-signature.js";
import { decodeJwtPayload } from "../internal/utils/jwt-payload.js";
import {
  redactSensitiveIdentity,
  redactVerifyOptions,
} from "../internal/utils/redact-sensitive-identity.js";
import { JOSE_THUMBPRINT_SHA1 } from "../internal/utils/jose-thumbprint-sha1.js";
import { resolveCertBinding } from "../internal/utils/resolve-cert-binding.js";
import { assertProtectedHeaderGates } from "../internal/utils/assert-protected-header-gates.js";
import { validateWireClaims } from "../internal/utils/validate-wire-claims.js";
import { verifyCertBinding } from "../internal/utils/verify-cert-binding.js";
import type {
  CertificateBindingMode,
  JoseDecodedStructuredToken,
  JwtClaimsWire,
  JwtKitSettings,
  JoseSignStructuredTokenOptions,
  JoseVerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../types/index.js";

/**
 * The standalone WIRE JWT kit — a jose/jsonwebtoken-parity signer/verifier.
 *
 * It speaks ONLY the wire: `sign` serializes an already-jose-keyed claim dict
 * verbatim (no envelope injection, no hash derivation, no case/name mapping);
 * `verify` validates the structural + prudent SECURITY invariants (crit, typ
 * well-formedness, algorithm-match, signature, cert-binding, temporal range with
 * clock tolerance) plus a caller-supplied wire `assert`
 * predicate, and returns the native WIRE payload (`sub`/`exp`, not
 * `subject`/`expiresAt`). All DOMAIN policy — claim translation, named matchers,
 * exp PRESENCE, actor/delegation, DPoP proof, profiles — lives on the Aegis
 * verify path, never here.
 */
export class JwtKit implements IJwtKit {
  private readonly certBindingMode: CertificateBindingMode;
  private readonly clockTolerance: number;
  private readonly logger: ILogger;
  private readonly kryptos: IKryptos;

  constructor(options: JwtKitSettings) {
    this.logger = options.logger.child(["JwtKit"]);
    this.kryptos = options.kryptos;

    this.certBindingMode = options.certBindingMode ?? "strict";
    this.clockTolerance = options.clockTolerance ?? 0;
  }

  get algorithm(): IKryptos["algorithm"] {
    return this.kryptos.algorithm;
  }

  /**
   * TRANSFORM-FREE sign: serialize the already-wire jose-keyed `claims`
   * dict and secure it. Injects NO envelope claims (`iat`/`jti`/`nbf`/`iss`),
   * derives no hash, maps no case or name — the Aegis claim assembly owns all of
   * that. Returns JUST the token; the expiry/id conveniences are DOMAIN sugar,
   * derived Aegis-side. The kit constructs the full `typ` media type from the
   * `options.typ` PREFIX (it knows its format).
   *
   * The normalisation the dict passes through is none of those three: it drops
   * `undefined` and the empty value of a claim the REGISTRY declares carries
   * nothing (`internal/utils/normalise-claims.ts`). It renames nothing, adds
   * nothing, and reads no key the registry has not declared — which is why the
   * kit may consult the registry without owning a claim vocabulary.
   */
  sign<C extends Dict = Dict>(
    claims: JwtClaimsWire & C,
    options: JoseSignStructuredTokenOptions = {},
  ): string {
    this.logger.debug("Signing token", {
      claims: redactSensitiveIdentity(claims),
      options,
    });

    const payload = B64.encode(JSON.stringify(normaliseClaims(claims)), B64U);

    // NO `cty` default. RFC 7519 §5.2: "In the normal case in which nested
    // signing or encryption operations are not employed, the use of this Header
    // Parameter is NOT RECOMMENDED." A JWT's payload is a claims set BY
    // DEFINITION (§3), so stamping `application/json` on every one restated the
    // format and left the parameter unavailable for the one thing it is for. A
    // caller `header.cty` still wins — it is how a NESTED token declares itself.
    const header = encodeJoseHeader(
      buildJoseHeader({
        reserved: KIT_CAPABILITIES.jwt.reserved,
        defaults: { jku: this.kryptos.jwksUri ?? undefined },
        header: options.header,
        custom: options.custom,
        derived: {
          alg: this.kryptos.algorithm,
          kid: this.kryptos.id,
          typ: buildMediaType(options.tokenType, "jwt"),
        },
        cert: resolveCertBinding(
          this.kryptos,
          options.bindCertificate,
          JOSE_THUMBPRINT_SHA1,
        ),
        format: "jwt",
        error: JwtError,
      }),
    );

    const signature = createJoseSignature({
      header,
      payload,
      kryptos: this.kryptos,
    });

    const token = `${header}.${payload}.${signature}`;

    this.logger.debug("Token signed", { token: sanitiseToken(token) });

    return token;
  }

  /**
   * WIRE verify: crit + typ well-formedness + algorithm-match + signature +
   * cert-binding + temporal range (validated-if-present) + the caller
   * `assert` predicate. A kid fail-fast short-circuits before the signature
   * cycle. Returns the native WIRE payload; NO named matchers, NO exp presence,
   * NO actor/DPoP — those are the Aegis verify path's job.
   */
  verify<C extends Dict = Dict>(
    token: string,
    assert?: Condition<JwtClaimsWire & C>,
    options: VerifyStructuredTokenOptions = {},
  ): JoseVerifiedStructuredToken<JwtClaimsWire & C> {
    this.logger.debug("Verifying token", {
      token: sanitiseToken(token),
      options: redactVerifyOptions(options),
    });

    const decoded = JwtKit.decode<C>(token);

    const decodedHeader = decoded.header;

    // kid fail-fast, before the (expensive) signature cycle. The COSE claims
    // path runs the same one; the OPAQUE and ENCRYPTED doors deliberately run
    // none.
    assertKidMatch({
      actual: decodedHeader.kid,
      expected: this.kryptos.id,
      format: "jwt",
      error: JwtError,
    });

    // typ well-formedness (folded from the removed `parse`): a PRESENT typ must
    // be a JWT media type so a JWS/JWE cannot be verified as a JWT. A typ-LESS
    // token is accepted here — presence requiredness is a DOMAIN/profile policy.
    const typ = decodedHeader.typ;
    assertWireTyp({
      typ,
      accept: ["JWT"],
      suffix: "+jwt",
      presence: "optional",
      error: JwtError,
      code: "jwt_invalid_typ",
      title: "JWT Invalid Typ",
      details:
        "Header typ is present but is not JWT or a <type>+jwt media type, so the token cannot be verified as a JWT.",
    });

    // `crit` (RFC 7515 §4.1.11) then algorithm-match — the ONE pair, in the ONE
    // order, that every wire runs ahead of its signature or AEAD cycle.
    assertProtectedHeaderGates({
      protectedHeader: decodedHeader,
      custom: decoded.custom.header,
      declared: options.crit,
      expectedAlgorithm: this.kryptos.algorithm,
      format: "jwt",
      error: JwtError,
      algDetails:
        "The header alg does not match the signing algorithm of the configured kryptos key.",
    });

    // typ assertion: the kit builds the expected media type from the PREFIX
    // (the Aegis path derives the prefix from the domain tokenType).
    assertTokenTypeMatch({
      typ,
      tokenType: options.tokenType,
      format: "jwt",
      error: JwtError,
    });

    const verified = verifyJoseSignature(this.kryptos, token);

    if (!verified) {
      throw new JwtError("Invalid token", {
        code: "jwt_signature_invalid",
        debug: { token: sanitiseToken(token) },
        title: "JWT Signature Invalid",
        details:
          "The signature did not verify against the configured kryptos key, indicating the JWT was tampered with or signed by another key.",
      });
    }

    // Content tamper check: runs AFTER signature verification with the
    // configured kryptos. NOT a key selection step — header cert fields are
    // never trusted as key sources (see the SECURITY INVARIANT in Aegis).
    verifyCertBinding({
      header: {
        certificateThumbprint: decodedHeader["x5t#S256"],
        certificateThumbprintSha1: decodedHeader.x5t,
      },
      kryptos: this.kryptos,
      logger: this.logger,
      mode: options.certBindingMode ?? this.certBindingMode,
    });

    // Temporal range — every temporal claim validated IF PRESENT — plus
    // the caller's wire `assert` predicate, in one pass over the Date-lifted
    // wire payload. The JOSE lift happens HERE: a NumericDate is an integer on
    // this wire and a `Date` on the COSE one, which is encoding, not policy.
    validateWireClaims({
      claims: withJoseDates(decoded.payload),
      assert: assert as Condition<Dict> | undefined,
      options,
      clockTolerance: options.clockTolerance ?? this.clockTolerance,
      format: "jwt",
      error: JwtError,
    });

    this.logger.debug("Token verified");

    return {
      header: decodedHeader,
      custom: decoded.custom,
      payload: decoded.payload,
      token,
    };
  }

  // public static

  /**
   * Is this a JWT aegis can process — a JWS whose payload is a claims set (RFC
   * 7519 §3), signed with an algorithm on the allowlist?
   *
   * The `typ` header decides nothing. RFC 7519 §5.1 makes it OPTIONAL and an
   * id_token carries none, while RFC 9068 (`at+jwt`), RFC 9449 (`dpop+jwt`) and
   * RFC 8417 (`secevent+jwt`) each stamp their own — so a fixed spelling
   * recognises only what aegis itself minted and rejects every externally issued
   * token. What decides it is the payload being a JSON claims object, which is
   * also what keeps a signed OPAQUE handle out: it stays a JWS, and a token
   * DECLARING a claims typ over a non-claims payload is not believed.
   */
  static isJwt(jwt: string): boolean {
    return isJwtFormat(jwt) && isSupportedJoseAlgorithm(jwt);
  }

  /**
   * WIRE decode (no signature check): the unified wire header (the single JOSE
   * protected header) + the cleartext JWT claim payload. The uniform primitive
   * shared with `CwtKit`/`CwmKit` decode — read the structure without verifying.
   */
  static decode<C extends Dict = Dict>(
    token: string,
  ): JoseDecodedStructuredToken<JwtClaimsWire & C> {
    const [header, payload, signature] = token.split(".");
    const decoded = decodeJoseHeader(header);

    return {
      header: decoded.header,
      custom: { header: decoded.custom },
      payload: decodeJwtPayload<C>(payload) as JwtClaimsWire & C,
      signature,
      token,
    };
  }
}
