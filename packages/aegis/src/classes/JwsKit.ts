import { B64 } from "@lindorm/b64";
import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { sanitiseToken } from "@lindorm/utils";
import { JwsError } from "../errors/index.js";
import type { IJwsKit } from "../interfaces/index.js";
import { B64U } from "../internal/constants/format.js";
import { buildMediaType } from "../internal/utils/compute-typ-header.js";
import { reconstructContent, serialiseContent } from "../internal/utils/content-codec.js";
import { decodeJoseHeader, encodeJoseHeader } from "../internal/utils/jose-header.js";
import {
  createJoseSignature,
  verifyJoseSignature,
} from "../internal/utils/jose-signature.js";
import { resolveCertBinding } from "../internal/utils/resolve-cert-binding.js";
import { validateCrit } from "../internal/utils/validate-crit.js";
import { verifyCertBinding } from "../internal/utils/verify-cert-binding.js";
import { wireHeaderToDomainOptions } from "../internal/utils/wire-header-to-domain.js";
import type {
  CertificateBindingMode,
  DecodedUnstructuredToken,
  DomainTokenHeaderOptions,
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

    // Serialise from the JS type; the cty defaults to the inferred type and a
    // caller `header.cty` (folded in below) wins as the WIRE label.
    const { bytes, contentType } = serialiseContent(data, options.header?.cty);

    const headerOptions: DomainTokenHeaderOptions = {
      contentType,
      ...wireHeaderToDomainOptions(options.header),
      algorithm: this.kryptos.algorithm,
      headerType: buildMediaType(options.tokenType, "jws"),
      jwksUri: this.kryptos.jwksUri ?? undefined,
      keyId: this.kryptos.id,
    };

    const cert = resolveCertBinding(
      this.kryptos,
      options.bindCertificate,
      options.certificateThumbprintSha1,
    );

    const header = encodeJoseHeader(headerOptions, cert);

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
    const typ = decoded.header.typ;
    if (
      typ !== undefined &&
      typ !== "JWS" &&
      typ !== "JOSE" &&
      !(typeof typ === "string" && typ.endsWith("+jws"))
    ) {
      throw new JwsError("Invalid token", {
        code: "jws_invalid_typ",
        data: { typ },
        title: "JWS Invalid Typ",
        details: "Header typ must be JWS, JOSE, a <type>+jws media type, or undefined.",
      });
    }

    const critError = validateCrit(decoded.header);
    if (critError) {
      throw new JwsError(`Invalid crit header: ${critError}`, {
        code: "jws_invalid_crit",
        data: { crit: decoded.header.crit },
        title: "JWS Invalid Crit",
        details:
          "The crit header is malformed; it must be a non-empty array of strings naming extension parameters present in the header.",
      });
    }

    // RFC 7515 Section 4.1.11: reject any critical extension params we don't understand
    if (decoded.header.crit?.length) {
      for (const param of decoded.header.crit) {
        throw new JwsError(`Unsupported critical header parameter: ${param}`, {
          code: "jws_unsupported_crit_param",
          data: { param },
          title: "JWS Unsupported Crit Param",
          details:
            "The crit header marks an extension parameter as critical that Aegis does not understand, so the JWS must be rejected.",
        });
      }
    }

    if (this.kryptos.algorithm !== decoded.header.alg) {
      throw new JwsError("Invalid token", {
        code: "jws_algorithm_mismatch",
        data: { algorithm: decoded.header.alg },
        debug: { expected: this.kryptos.algorithm },
        title: "JWS Algorithm Mismatch",
        details:
          "The header alg does not match the signing algorithm of the configured kryptos key.",
      });
    }

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
      header: { certificateThumbprint: decoded.header["x5t#S256"] },
      kryptos: this.kryptos,
      logger: this.logger,
      mode: options.certBindingMode ?? this.certBindingMode,
    });

    // The payload was reconstructed by cty in `decode`; the signature is verified
    // above, so the reconstructed content is now trustworthy.
    this.logger.debug("Token verified");

    return { header: decoded.header, payload: decoded.payload, token };
  }

  // public static

  static isJws(jws: string): boolean {
    if (typeof jws !== "string") return false;
    const parts = jws.split(".");
    if (parts.length !== 3) return false;
    try {
      const header = decodeJoseHeader(parts[0]);
      if (typeof header.alg !== "string") return false;
      const typ = header.typ;
      return (
        typ === "JWS" ||
        typ === "JOSE" ||
        (typeof typ === "string" && typ.endsWith("+jws"))
      );
    } catch {
      return false;
    }
  }

  static decode<T extends TokenContent = string>(
    token: string,
  ): DecodedUnstructuredToken<T, string> {
    const [h, payload, signature] = token.split(".");
    const header = decodeJoseHeader(h);

    return {
      header: header,
      payload: reconstructContent<T>(B64.toBuffer(payload, B64U), header.cty),
      signature,
      token,
    };
  }
}
