import { B64 } from "@lindorm/b64";
import { isBuffer, isString } from "@lindorm/is";
import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { B64U } from "#internal/constants/format";
import { JwsError } from "../errors";
import { IJwsKit } from "../interfaces";
import {
  DecodedJws,
  JwsKitOptions,
  ParsedJws,
  ParsedJwsHeader,
  SignJwsOptions,
  SignedJws,
  TokenHeaderOptions,
} from "../types";
import {
  computeTypHeader,
  decodeTokenTypeFromTyp,
} from "#internal/utils/compute-typ-header";
import { decodeJoseHeader, encodeJoseHeader } from "#internal/utils/jose-header";
import { createJoseSignature, verifyJoseSignature } from "#internal/utils/jose-signature";
import { parseTokenHeader } from "#internal/utils/token-header";
import { resolveCertBinding } from "#internal/utils/resolve-cert-binding";
import { verifyCertBinding } from "#internal/utils/verify-cert-binding";
import { validateCrit } from "#internal/utils/validate-crit";

export class JwsKit implements IJwsKit {
  private readonly logger: ILogger;
  private readonly kryptos: IKryptos;

  public constructor(options: JwsKitOptions) {
    this.logger = options.logger.child(["JwsKit"]);
    this.kryptos = options.kryptos;
  }

  public sign<T extends Buffer | string>(
    data: T,
    options: SignJwsOptions = {},
  ): SignedJws {
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

  public verify<T extends Buffer | string>(token: string): ParsedJws<T> {
    this.logger.debug("Verifying token", { token });

    const parsed = JwsKit.parse<T>(token);

    // RFC 7515 Section 4.1.11: reject any critical extension params we don't understand
    if (parsed.header.critical?.length) {
      for (const param of parsed.header.critical) {
        throw new JwsError(`Unsupported critical header parameter: ${param}`);
      }
    }

    if (this.kryptos.algorithm !== parsed.header.algorithm) {
      throw new JwsError("Invalid token", {
        data: { algorithm: parsed.header.algorithm },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    const verified = verifyJoseSignature(this.kryptos, token);

    if (!verified) {
      throw new JwsError("Invalid token", {
        data: { verified, token: token },
      });
    }

    // Content tamper check: runs AFTER signature verification has succeeded
    // with the amphora-sourced kryptos. NOT a key selection step. Header
    // cert fields remain forbidden as key sources — see the SECURITY
    // INVARIANT in Aegis.kryptosSig.
    verifyCertBinding(this.kryptos, {
      x5t: parsed.header.x5t,
      x5tS256: parsed.header.x5tS256,
    });

    this.logger.debug("Token verified");

    return parsed;
  }

  // public static

  public static isJws(jws: string): boolean {
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

  public static decode(jws: string): DecodedJws {
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

  public static parse<T extends Buffer | string>(token: string): ParsedJws<T> {
    const decoded = JwsKit.decode(token);

    const typ = decoded.header.typ;
    if (
      typ !== undefined &&
      typ !== "JWS" &&
      typ !== "JOSE" &&
      !(typeof typ === "string" && typ.endsWith("+jws"))
    ) {
      throw new JwsError("Invalid token", {
        data: { typ },
        details: "Header type must be JWS, JOSE, <type>+jws, or undefined",
      });
    }

    const critError = validateCrit(decoded.header);
    if (critError) {
      throw new JwsError(`Invalid crit header: ${critError}`, {
        data: { crit: decoded.header.crit },
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
