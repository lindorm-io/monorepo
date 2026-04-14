import { AesKit } from "@lindorm/aes";
import { B64 } from "@lindorm/b64";
import { isString } from "@lindorm/is";
import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { B64U } from "#internal/constants/format";
import { JweError } from "../errors";
import { IJweKit } from "../interfaces";
import {
  CertBindingMode,
  DecodedJwe,
  DecryptedJwe,
  DecryptedJweHeader,
  EncryptedJwe,
  JweEncryptOptions,
  JweKitOptions,
  TokenHeaderOptions,
} from "../types";
import {
  computeTypHeader,
  decodeTokenTypeFromTyp,
} from "#internal/utils/compute-typ-header";
import { decodeJoseHeader, encodeJoseHeader } from "#internal/utils/jose-header";
import { parseTokenHeader } from "#internal/utils/token-header";
import { resolveCertBinding } from "#internal/utils/resolve-cert-binding";
import { verifyCertBinding } from "#internal/utils/verify-cert-binding";
import { validateCrit } from "#internal/utils/validate-crit";
import { JwsKit } from "./JwsKit";
import { JwtKit } from "./JwtKit";

export class JweKit implements IJweKit {
  private readonly certBindingMode: CertBindingMode;
  private readonly encryption: KryptosEncryption;
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;

  public constructor(options: JweKitOptions) {
    this.logger = options.logger.child(["JweKit"]);
    this.kryptos = options.kryptos;
    this.encryption = options.encryption ?? options.kryptos.encryption ?? "A256GCM";
    this.certBindingMode = options.certBindingMode ?? "strict";
  }

  public encrypt(data: string, options: JweEncryptOptions = {}): EncryptedJwe {
    const kit = new AesKit({ encryption: this.encryption, kryptos: this.kryptos });

    this.logger.debug("Encrypting token", { options });

    const objectId = options.objectId;

    // Step 1: Prepare encryption (key management only — no content encrypted yet)
    const prepared = kit.prepareEncryption();

    // Step 2: Build the protected header with key management output
    // RFC 7515 Section 4.1.11: crit MUST NOT include registered Header Parameter names.
    // All params used here (alg, enc, epk, iv, tag, p2c, p2s) are registered JOSE params.
    // Only genuinely non-standard extension params would go in critical.
    // Omit crit entirely when there are no extension params.
    const critical: Array<string> = [];

    const headerOptions: TokenHeaderOptions = {
      ...(options.header ?? {}),
      algorithm: this.kryptos.algorithm,
      contentType: this.contentType(data),
      ...(critical.length ? { critical } : {}),
      encryption: this.encryption,
      headerType: computeTypHeader(options.tokenType, "jwe"),
      initialisationVector: prepared.headerParams.publicEncryptionIv,
      jwksUri: this.kryptos.jwksUri ?? undefined,
      keyId: this.kryptos.id,
      objectId,
      pbkdfIterations: prepared.headerParams.pbkdfIterations,
      pbkdfSalt: prepared.headerParams.pbkdfSalt,
      publicEncryptionJwk: prepared.headerParams.publicEncryptionJwk,
      publicEncryptionTag: prepared.headerParams.publicEncryptionTag,
    };

    const cert = resolveCertBinding(this.kryptos, options.bindCertificate);

    // Step 3: Encode header as base64url
    const header = encodeJoseHeader(headerOptions, cert);

    // Step 4: Compute AAD from the encoded protected header per RFC 7516 Section 5.1 step 14
    const aad = Buffer.from(header, "ascii");

    // Step 5: Encrypt content with AAD
    const { authTag, content, initialisationVector } = prepared.encrypt(data, { aad });

    if (!authTag) {
      throw new JweError("Missing auth tag");
    }

    // Step 6: Assemble the JWE compact serialisation
    const token = [
      header,
      prepared.publicEncryptionKey ? B64.encode(prepared.publicEncryptionKey, B64U) : "",
      B64.encode(initialisationVector, B64U),
      B64.encode(content, B64U),
      B64.encode(authTag, B64U),
    ].join(".");

    this.logger.debug("Token encrypted", { token });

    return { token };
  }

  public decrypt(token: string): DecryptedJwe {
    const kit = new AesKit({ encryption: this.encryption, kryptos: this.kryptos });

    this.logger.debug("Decrypting token", { token });

    const decoded = JweKit.decode(token);

    const typ = decoded.header.typ;
    if (typ !== "JWE" && !(typeof typ === "string" && typ.endsWith("+jwe"))) {
      throw new JweError("Invalid token", {
        data: { typ },
      });
    }

    // Aegis deliberately does not support compressed payloads (RFC 7516 §4.1.3).
    // Compression-before-encryption enables oracle attacks (CVE-2016-1000031 class).
    // Explicit rejection is safer than silent passthrough.
    if ((decoded.header as { zip?: unknown }).zip !== undefined) {
      throw new JweError("Compressed JWE payloads are not supported", {
        data: { zip: (decoded.header as { zip?: unknown }).zip },
      });
    }

    const critError = validateCrit(decoded.header);
    if (critError) {
      throw new JweError(`Invalid crit header: ${critError}`, {
        data: { crit: decoded.header.crit },
      });
    }

    if (this.kryptos.algorithm !== decoded.header.alg) {
      throw new JweError("Invalid token", {
        data: { alg: decoded.header.alg },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    const header = parseTokenHeader<DecryptedJweHeader>(decoded.header);
    header.tokenType = decodeTokenTypeFromTyp(typ, "jwe");

    if (header.encryption !== this.encryption) {
      throw new JweError("Unexpected encryption", {
        debug: { actual: header.encryption, encryption: this.encryption },
      });
    }

    // RFC 7515 Section 4.1.11: reject any critical extension params we don't understand
    if (header.critical?.length) {
      for (const param of header.critical) {
        throw new JweError(`Unsupported critical header parameter: ${param}`);
      }
    }

    // Reconstruct AAD from the encoded protected header per RFC 7516 Section 5.1 step 14
    const [headerB64] = token.split(".");
    const aad = Buffer.from(headerB64, "ascii");

    const authTag = B64.toBuffer(decoded.authTag);
    const content = B64.toBuffer(decoded.content);
    const initialisationVector = B64.toBuffer(decoded.initialisationVector);
    const pbkdfIterations = header.pbkdfIterations;
    const pbkdfSalt = header.pbkdfSalt ? B64.toBuffer(header.pbkdfSalt, B64U) : undefined;
    const publicEncryptionIv = header.initialisationVector
      ? B64.toBuffer(header.initialisationVector)
      : undefined;
    const publicEncryptionKey = decoded.publicEncryptionKey
      ? B64.toBuffer(decoded.publicEncryptionKey)
      : undefined;
    const publicEncryptionJwk = header.publicEncryptionJwk;
    const publicEncryptionTag = header.publicEncryptionTag
      ? B64.toBuffer(header.publicEncryptionTag)
      : undefined;

    const payload = kit.decrypt(
      {
        algorithm: header.algorithm,
        authTag,
        content,
        contentType: "text/plain",
        encryption: this.encryption,
        initialisationVector,
        keyId: header.keyId ?? this.kryptos.id,
        pbkdfIterations,
        pbkdfSalt,
        publicEncryptionIv,
        publicEncryptionJwk,
        publicEncryptionKey,
        publicEncryptionTag,
        version: "1.0",
      },
      { aad },
    );

    // Content tamper check: runs AFTER decryption has succeeded (AES-GCM
    // authenticated decryption validates AAD over the header). NOT a key
    // selection step — header cert fields remain forbidden as key sources.
    // See the SECURITY INVARIANT in Aegis.kryptosSig.
    verifyCertBinding({
      header: {
        x5tS256: header.x5tS256,
      },
      kryptos: this.kryptos,
      logger: this.logger,
      mode: this.certBindingMode,
    });

    this.logger.debug("Token decrypted");

    return { header, payload, decoded, token };
  }

  // public static

  public static isJwe(jwe: string): boolean {
    if (typeof jwe !== "string") return false;
    const parts = jwe.split(".");
    if (parts.length !== 5) return false;
    try {
      const header = decodeJoseHeader(parts[0]);
      if (typeof header.alg !== "string") return false;
      const typ = header.typ;
      return typ === "JWE" || (typeof typ === "string" && typ.endsWith("+jwe"));
    } catch {
      return false;
    }
  }

  public static decode(jwe: string): DecodedJwe {
    const parts = jwe.split(".");
    if (parts.length !== 5) {
      throw new JweError("Invalid JWE format: expected 5 parts");
    }

    const [header, publicEncryptionKey, initialisationVector, content, authTag] = parts;

    return {
      header: decodeJoseHeader(header),
      publicEncryptionKey: publicEncryptionKey?.length ? publicEncryptionKey : undefined,
      initialisationVector,
      content,
      authTag,
    };
  }

  // private

  private contentType(input: string): string {
    if (JwsKit.isJws(input)) {
      return "application/jws";
    }

    if (JwtKit.isJwt(input)) {
      return "application/jwt";
    }

    if (input.startsWith("{") && input.endsWith("}")) {
      return "application/json";
    }

    if (input.startsWith("[") && input.endsWith("]")) {
      return "application/json";
    }

    if (isString(input)) {
      return "text/plain; charset=utf-8";
    }

    return "application/unknown";
  }
}
