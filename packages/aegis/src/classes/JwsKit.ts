import { B64 } from "@lindorm/b64";
import { isJws as isJwsFormat } from "@lindorm/is";
import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { sanitiseToken } from "@lindorm/utils";
import { JwsError } from "../errors/index.js";
import type { IJwsKit } from "../interfaces/index.js";
import { B64U } from "../internal/constants/format.js";
import { buildJoseHeader } from "../internal/header/build-jose-header.js";
import { normaliseHeaders } from "../internal/header/normalise-headers.js";
import { KIT_CAPABILITIES } from "../internal/registry/kit-capabilities.js";
import { assertWireTyp } from "../internal/utils/assert-wire-typ.js";
import { buildMediaType } from "../internal/utils/compute-typ-header.js";
import { reconstructContent, serialiseContent } from "../internal/utils/content-codec.js";
import { isSupportedJoseAlgorithm } from "../internal/utils/is-supported-jose-algorithm.js";
import { decodeJoseHeader, encodeJoseHeader } from "../internal/utils/jose-header.js";
import {
  createJoseSignature,
  verifyJoseSignature,
} from "../internal/utils/jose-signature.js";
import { assertProtectedHeaderGates } from "../internal/utils/assert-protected-header-gates.js";
import { JOSE_THUMBPRINT_SHA1 } from "../internal/utils/jose-thumbprint-sha1.js";
import { resolveCertBinding } from "../internal/utils/resolve-cert-binding.js";
import { verifyCertBinding } from "../internal/utils/verify-cert-binding.js";
import type {
  CertificateBindingMode,
  DecodedUnstructuredToken,
  JwsKitSettings,
  SignUnstructuredTokenOptions,
  TokenContent,
  VerifiedUnstructuredToken,
  VerifyUnstructuredTokenOptions,
} from "../types/index.js";

export class JwsKit implements IJwsKit {
  private readonly certBindingMode: CertificateBindingMode;
  private readonly logger: ILogger;
  private readonly kryptos: IKryptos;

  constructor(options: JwsKitSettings) {
    this.logger = options.logger.child(["JwsKit"]);
    this.kryptos = options.kryptos;
    this.certBindingMode = options.certBindingMode ?? "strict";
  }

  /**
   * Sign the opaque payload and return the BARE compact JWS token string —
   * nothing else. The `objectId`/expiry sugar is DOMAIN enrichment built
   * Aegis-side.
   */
  sign(data: TokenContent, options: SignUnstructuredTokenOptions = {}): string {
    this.logger.debug("Signing token", { options });

    // A parameter that emits nothing is not a parameter, and the caller's bag is
    // normalised HERE because the next line READS it — a builder normalisation is
    // too late. An empty `cty` would be preferred over the inferred type and the
    // payload would come back a Buffer (`normalise-headers.ts`).
    const callerHeader = normaliseHeaders(options.header ?? {});

    // Serialise from the JS type; the cty defaults to the inferred type and a
    // caller `header.cty` (folded in below) wins as the WIRE label.
    const { bytes, contentType } = serialiseContent(data, callerHeader.cty);

    const header = encodeJoseHeader(
      buildJoseHeader({
        reserved: KIT_CAPABILITIES.jws.reserved,
        defaults: { cty: contentType, jku: this.kryptos.jwksUri ?? undefined },
        header: callerHeader,
        derived: {
          alg: this.kryptos.algorithm,
          kid: this.kryptos.id,
          typ: buildMediaType(options.tokenType, "jws"),
        },
        cert: resolveCertBinding(
          this.kryptos,
          options.bindCertificate,
          JOSE_THUMBPRINT_SHA1,
        ),
        format: "jws",
        error: JwsError,
      }),
    );

    const payload = bytes.toString(B64U);

    const signature = createJoseSignature({
      header,
      payload,
      kryptos: this.kryptos,
    });

    const token = `${header}.${payload}.${signature}`;

    this.logger.debug("Token signed", { token: sanitiseToken(token) });

    return token;
  }

  verify<T extends TokenContent = Buffer>(
    token: string,
    options: VerifyUnstructuredTokenOptions = {},
  ): VerifiedUnstructuredToken<T, string> {
    this.logger.debug("Verifying token", { token: sanitiseToken(token) });

    const decoded = JwsKit.decode<T>(token);

    // typ well-formedness: a PRESENT typ must be a JWS media type so a JWT/JWE
    // cannot be verified as a JWS. A typ-LESS token is accepted here — presence
    // requiredness is a DOMAIN/profile policy.
    assertWireTyp({
      typ: decoded.protectedHeader.typ,
      accept: ["JWS", "JOSE"],
      suffix: "+jws",
      presence: "optional",
      error: JwsError,
      code: "jws_invalid_typ",
      title: "JWS Invalid Typ",
      details: "Header typ must be JWS, JOSE, a <type>+jws media type, or undefined.",
    });

    // `crit` (RFC 7515 §4.1.11) then algorithm-match — the ONE pair, in the ONE
    // order, that every wire runs ahead of its signature or AEAD cycle.
    assertProtectedHeaderGates({
      protectedHeader: decoded.protectedHeader,
      expectedAlgorithm: this.kryptos.algorithm,
      format: "jws",
      error: JwsError,
      algDetails:
        "The header alg does not match the signing algorithm of the configured kryptos key.",
    });

    const verified = verifyJoseSignature(this.kryptos, token);

    if (!verified) {
      throw new JwsError("Invalid token", {
        code: "jws_signature_invalid",
        debug: { token: sanitiseToken(token) },
        title: "JWS Signature Invalid",
        details:
          "The signature did not verify against the configured kryptos key, indicating the JWS was tampered with or signed by another key.",
      });
    }

    // Content tamper check: runs AFTER signature verification has succeeded
    // with the amphora-sourced kryptos. NOT a key selection step. Header
    // cert fields remain forbidden as key sources — see the SECURITY
    // INVARIANT in Aegis.kryptosSig.
    verifyCertBinding({
      header: {
        certificateThumbprint: decoded.protectedHeader["x5t#S256"],
        certificateThumbprintSha1: decoded.protectedHeader.x5t,
      },
      kryptos: this.kryptos,
      logger: this.logger,
      mode: options.certBindingMode ?? this.certBindingMode,
    });

    // The payload was reconstructed by cty in `decode`; the signature is verified
    // above, so the reconstructed content is now trustworthy.
    this.logger.debug("Token verified");

    return {
      protectedHeader: decoded.protectedHeader,
      unprotectedHeader: decoded.unprotectedHeader,
      payload: decoded.payload,
      token,
    };
  }

  // public static

  /**
   * Is this the JWS Compact Serialization (RFC 7515 §7.1), signed with an
   * algorithm on the allowlist? Three segments and a REQUIRED `alg` — never a
   * `typ`, which §4.1.9 makes OPTIONAL and which an external issuer usually
   * omits, so routing on the `JWS`/`JOSE`/`+jws` spellings recognised only what
   * aegis itself minted.
   *
   * Deliberately a SUPERSET of {@link JwtKit.isJwt}: RFC 7519 §3 makes every JWT
   * a JWS. The dispatchers ask the narrow question first, so a claims token
   * still reaches the JWT branch and only what is left over — the genuinely
   * opaque signed payloads — arrives here.
   */
  static isJws(jws: string): boolean {
    return isJwsFormat(jws) && isSupportedJoseAlgorithm(jws);
  }

  static decode<T extends TokenContent = string>(
    token: string,
  ): DecodedUnstructuredToken<T, string> {
    const [h, payload, signature] = token.split(".");
    const header = decodeJoseHeader(h);

    return {
      protectedHeader: header,
      // Compact JOSE serialisation has ONE header and it is protected — there is
      // no unprotected bucket to report (`KIT_CAPABILITIES.jws.unprotectedBucket`).
      unprotectedHeader: {},
      payload: reconstructContent<T>(B64.toBuffer(payload, B64U), header.cty),
      signature,
      token,
    };
  }
}
