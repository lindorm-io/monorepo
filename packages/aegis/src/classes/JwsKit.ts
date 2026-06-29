import { B64 } from "@lindorm/b64";
import { isBuffer, isString } from "@lindorm/is";
import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { B64U } from "../internal/constants/format.js";
import { JwsError } from "../errors/index.js";
import type { IJwsKit } from "../interfaces/index.js";
import type {
  CertBindingMode,
  DecodedJws,
  JwsKitOptions,
  ParsedJws,
  ParsedJwsHeader,
  SignJwsOptions,
  SignedJws,
  TokenHeaderOptions,
} from "../types/index.js";
import {
  computeTypHeader,
  decodeTokenTypeFromTyp,
} from "../internal/utils/compute-typ-header.js";
import { decodeJoseHeader, encodeJoseHeader } from "../internal/utils/jose-header.js";
import {
  createJoseSignature,
  verifyJoseSignature,
} from "../internal/utils/jose-signature.js";
import { parseTokenHeader } from "../internal/utils/token-header.js";
import { resolveCertBinding } from "../internal/utils/resolve-cert-binding.js";
import { verifyCertBinding } from "../internal/utils/verify-cert-binding.js";
import { validateCrit } from "../internal/utils/validate-crit.js";

export class JwsKit implements IJwsKit {
  private readonly certBindingMode: CertBindingMode;
  private readonly logger: ILogger;
  private readonly kryptos: IKryptos;

  constructor(options: JwsKitOptions) {
    this.logger = options.logger.child(["JwsKit"]);
    this.kryptos = options.kryptos;
    this.certBindingMode = options.certBindingMode ?? "strict";
  }

  sign<T extends Buffer | string>(data: T, options: SignJwsOptions = {}): SignedJws {
    this.logger.debug("Signing token", { options });

    const objectId = options.objectId;

    const headerOptions: TokenHeaderOptions = {
      ...(options.header ?? {}),
      algorithm: this.kryptos.algorithm,
      contentType: options.contentType
        ? options.contentType
        : isString(data)
          ? "text/plain; charset=utf-8"
          : "application/octet-stream",
      headerType: computeTypHeader(options.tokenType, "jws"),
      jwksUri: this.kryptos.jwksUri ?? undefined,
      keyId: this.kryptos.id,
      objectId,
    };

    const cert = resolveCertBinding(this.kryptos, options.bindCertificate);

    const header = encodeJoseHeader(headerOptions, cert);

    const payload = isBuffer(data) ? data.toString(B64U) : B64.encode(data, B64U);

    const signature = createJoseSignature({
      header,
      payload,
      kryptos: this.kryptos,
    });

    const token = `${header}.${payload}.${signature}`;

    this.logger.debug("Token signed", { token });

    return { objectId, token };
  }

  verify<T extends Buffer | string>(token: string): ParsedJws<T> {
    this.logger.debug("Verifying token", { token });

    const parsed = JwsKit.parse<T>(token);

    // RFC 7515 Section 4.1.11: reject any critical extension params we don't understand
    if (parsed.header.critical?.length) {
      for (const param of parsed.header.critical) {
        throw new JwsError(`Unsupported critical header parameter: ${param}`, {
          code: "jws_unsupported_crit_param",
          data: { param },
          title: "JWS Unsupported Crit Param",
          details:
            "The crit header marks an extension parameter as critical that Aegis does not understand, so the JWS must be rejected.",
        });
      }
    }

    if (this.kryptos.algorithm !== parsed.header.algorithm) {
      throw new JwsError("Invalid token", {
        code: "jws_algorithm_mismatch",
        data: { algorithm: parsed.header.algorithm },
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
        debug: { token },
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
        x5tS256: parsed.header.x5tS256,
      },
      kryptos: this.kryptos,
      logger: this.logger,
      mode: this.certBindingMode,
    });

    this.logger.debug("Token verified");

    return parsed;
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

  static decode(jws: string): DecodedJws {
    const [header, payload, signature] = jws.split(".");
    const decodedHeader = decodeJoseHeader(header);

    return {
      header: decodedHeader,
      payload:
        decodedHeader.cty === "text/plain; charset=utf-8"
          ? B64.toString(payload)
          : payload,
      signature,
    };
  }

  static parse<T extends Buffer | string>(token: string): ParsedJws<T> {
    const decoded = JwsKit.decode(token);

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

    const header = parseTokenHeader<ParsedJwsHeader>(decoded.header);
    header.tokenType = decodeTokenTypeFromTyp(typ, "jws");
    header.baseFormat = "JWS";

    const payload =
      header.contentType === "text/plain; charset=utf-8"
        ? (decoded.payload as T)
        : (B64.toBuffer(decoded.payload, B64U) as T);

    return { decoded, header, payload, token };
  }
}
