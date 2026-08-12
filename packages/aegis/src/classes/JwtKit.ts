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
import { applyOmit } from "../internal/utils/apply-omit.js";
import { buildMediaType } from "../internal/utils/compute-typ-header.js";
import { isSupportedJoseAlgorithm } from "../internal/utils/is-supported-jose-algorithm.js";
import { decodeJoseHeader, encodeJoseHeader } from "../internal/utils/jose-header.js";
import {
  createJoseSignature,
  verifyJoseSignature,
} from "../internal/utils/jose-signature.js";
import { decodeJwtPayload } from "../internal/utils/jwt-payload.js";
import { createTemporalMatchers } from "../internal/utils/jwt-temporal-matchers.js";
import {
  redactSensitiveIdentity,
  redactVerifyOptions,
} from "../internal/utils/redact-sensitive-identity.js";
import { resolveCertBinding } from "../internal/utils/resolve-cert-binding.js";
import { rejectUnknownCritical } from "../internal/utils/reject-unknown-critical.js";
import { validate } from "../internal/utils/validate.js";
import { verifyCertBinding } from "../internal/utils/verify-cert-binding.js";
import { wireHeaderToDomainOptions } from "../internal/utils/wire-header-to-domain.js";
import type {
  CertificateBindingMode,
  DecodedStructuredToken,
  DomainTokenHeaderOptions,
  JwtClaimsWire,
  JwtKitSettings,
  SignStructuredTokenOptions,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../types/index.js";

/**
 * The standalone WIRE JWT kit — a jose/jsonwebtoken-parity signer/verifier.
 *
 * It speaks ONLY the wire: `sign` serializes an already-jose-keyed claim dict
 * verbatim (R18 — no envelope injection, no hash derivation, no case/name
 * mapping); `verify` validates the structural + prudent SECURITY invariants
 * (crit, typ well-formedness, algorithm-match, signature, cert-binding, temporal
 * range with clock tolerance — R10) plus a caller-supplied wire `assert`
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
   * TRANSFORM-FREE sign (R18): serialize the already-wire jose-keyed `claims`
   * dict verbatim (modulo the `omit` knob) and secure it. Injects NO envelope
   * claims (`iat`/`jti`/`nbf`/`iss`), derives no hash, maps no case or name — the
   * Aegis claim assembly owns all of that. Returns JUST the token; the expiry/id
   * conveniences are DOMAIN sugar, derived Aegis-side. The kit constructs the
   * full `typ` media type from the `options.typ` PREFIX (it knows its format).
   */
  sign<C extends Dict = Dict>(
    claims: JwtClaimsWire & C,
    options: SignStructuredTokenOptions = {},
  ): string {
    this.logger.debug("Signing token", {
      claims: redactSensitiveIdentity(claims),
      options,
    });

    const payload = B64.encode(JSON.stringify(applyOmit(claims, options.omit)), B64U);

    const headerOptions: DomainTokenHeaderOptions = {
      contentType: "application/json",
      ...wireHeaderToDomainOptions(options.header),
      algorithm: this.kryptos.algorithm,
      headerType: buildMediaType(options.tokenType, "jwt"),
      jwksUri: this.kryptos.jwksUri ?? undefined,
      keyId: this.kryptos.id,
    };

    const cert = resolveCertBinding(
      this.kryptos,
      options.bindCertificate,
      options.certificateThumbprintSha1,
    );

    const header = encodeJoseHeader(headerOptions, cert);

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
   * cert-binding + temporal range (R10, validated-if-present) + the caller
   * `assert` predicate. A kid fail-fast short-circuits before the signature
   * cycle. Returns the native WIRE payload; NO named matchers, NO exp presence,
   * NO actor/DPoP — those are the Aegis verify path's job.
   */
  verify<C extends Dict = Dict>(
    token: string,
    assert?: Condition<JwtClaimsWire & C>,
    options: VerifyStructuredTokenOptions = {},
  ): VerifiedStructuredToken<JwtClaimsWire & C, string> {
    this.logger.debug("Verifying token", {
      token: sanitiseToken(token),
      options: redactVerifyOptions(options),
    });

    const decoded = JwtKit.decode<C>(token);

    // kid fail-fast: a token that names a kid different from the configured key
    // cannot verify, so reject it before the (expensive) signature cycle. Via
    // Aegis the handed key already matches; this protects the standalone case.
    const decodedHeader = decoded.protectedHeader;

    if (decodedHeader.kid && this.kryptos.id && decodedHeader.kid !== this.kryptos.id) {
      throw new JwtError("Invalid token", {
        code: "jwt_kid_mismatch",
        data: { kid: decodedHeader.kid },
        debug: { expected: this.kryptos.id },
        title: "JWT Kid Mismatch",
        details:
          "The token's kid names a different key than the one configured on this kit, so it cannot be verified here.",
      });
    }

    // typ well-formedness (folded from the removed `parse`): a PRESENT typ must
    // be a JWT media type so a JWS/JWE cannot be verified as a JWT. A typ-LESS
    // token is accepted here — presence requiredness is a DOMAIN/profile policy.
    const typ = decodedHeader.typ;
    if (typ !== undefined && typ !== "JWT" && !typ.endsWith("+jwt")) {
      throw new JwtError("Invalid token", {
        code: "jwt_invalid_typ",
        data: { typ },
        title: "JWT Invalid Typ",
        details:
          "Header typ is present but is not JWT or a <type>+jwt media type, so the token cannot be verified as a JWT.",
      });
    }

    // `crit` (RFC 7515 §4.1.11), the SAME enforcement the COSE kits run — one
    // implementation, so the two wires cannot disagree about a hostile token.
    rejectUnknownCritical({ header: decodedHeader, format: "jwt", error: JwtError });

    if (this.kryptos.algorithm !== decodedHeader.alg) {
      throw new JwtError("Invalid token", {
        code: "jwt_algorithm_mismatch",
        data: { algorithm: decodedHeader.alg },
        debug: { expected: this.kryptos.algorithm },
        title: "JWT Algorithm Mismatch",
        details:
          "The header alg does not match the signing algorithm of the configured kryptos key.",
      });
    }

    // typ assertion: the kit builds the expected media type from the PREFIX
    // (the Aegis path derives the prefix from the domain tokenType).
    if (options.tokenType !== undefined) {
      const expected = buildMediaType(options.tokenType, "jwt");
      if (typ !== expected) {
        throw new JwtError("Invalid token", {
          code: "jwt_typ_mismatch",
          data: { typ },
          debug: { expected },
          title: "JWT Typ Mismatch",
          details: "The header typ does not match the typ expected during verification.",
        });
      }
    }

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
      header: { certificateThumbprint: decodedHeader["x5t#S256"] },
      kryptos: this.kryptos,
      logger: this.logger,
      mode: options.certBindingMode ?? this.certBindingMode,
    });

    // Temporal range (R10) — every temporal claim validated IF PRESENT — plus
    // the caller's wire `assert` predicate, in one pass over the Date-lifted
    // wire payload.
    const clockTolerance = options.clockTolerance ?? this.clockTolerance;
    const withDates = {
      ...decoded.payload,
      exp: decoded.payload.exp ? new Date(decoded.payload.exp * 1000) : undefined,
      iat: decoded.payload.iat ? new Date(decoded.payload.iat * 1000) : undefined,
      nbf: decoded.payload.nbf ? new Date(decoded.payload.nbf * 1000) : undefined,
      auth_time: decoded.payload.auth_time
        ? new Date(decoded.payload.auth_time * 1000)
        : undefined,
    };

    validate(
      withDates,
      {
        ...createTemporalMatchers({
          clockTolerance,
          currentDate: options.currentDate,
          maxTokenAge: options.maxTokenAge,
          verifyExpiration: options.verifyExpiration,
          verifyNotBefore: options.verifyNotBefore,
          verifyIssuedAt: options.verifyIssuedAt,
          verifyAuthTime: options.verifyAuthTime,
        }),
        ...(assert ?? {}),
      } as Condition<Dict>,
      JwtError,
      "jwt_claims_invalid",
    );

    this.logger.debug("Token verified");

    return {
      protectedHeader: decodedHeader,
      unprotectedHeader: decoded.unprotectedHeader,
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
  ): DecodedStructuredToken<JwtClaimsWire & C, string> {
    const [header, payload, signature] = token.split(".");

    return {
      protectedHeader: decodeJoseHeader(header),
      // Compact JOSE serialisation has ONE header and it is protected — there is
      // no unprotected bucket to report (`KIT_CAPABILITIES.jwt.unprotectedBucket`).
      unprotectedHeader: {},
      payload: decodeJwtPayload<C>(payload) as JwtClaimsWire & C,
      signature,
      token,
    };
  }
}
