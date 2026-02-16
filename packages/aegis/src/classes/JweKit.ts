import { AesKit } from "@lindorm/aes";
import { B64 } from "@lindorm/b64";
import { isJwe, isJws, isJwt, isString } from "@lindorm/is";
import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { B64U } from "../constants/private";
import { JweError } from "../errors";
import { IJweKit } from "../interfaces";
import {
  DecodedJwe,
  DecryptedJwe,
  DecryptedJweHeader,
  EncryptedJwe,
  JweEncryptOptions,
  JweKitOptions,
  TokenHeaderOptions,
} from "../types";
import { decodeJoseHeader, encodeJoseHeader, parseTokenHeader } from "../utils/private";

export class JweKit implements IJweKit {
  private readonly encryption: KryptosEncryption;
  private readonly kryptos: IKryptos;
  private readonly logger: ILogger;

  public constructor(options: JweKitOptions) {
    this.logger = options.logger.child(["JweKit"]);
    this.kryptos = options.kryptos;
    this.encryption = options.encryption ?? options.kryptos.encryption ?? "A256GCM";
  }

  public encrypt(data: string, options: JweEncryptOptions = {}): EncryptedJwe {
    const kit = new AesKit({ encryption: this.encryption, kryptos: this.kryptos });

    this.logger.debug("Encrypting token", { options });

    const objectId = options.objectId ?? randomUUID();

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
      headerType: "JWE",
      initialisationVector: prepared.headerParams.publicEncryptionIv,
      jwksUri: this.kryptos.jwksUri ?? undefined,
      keyId: this.kryptos.id,
      objectId,
      pbkdfIterations: prepared.headerParams.pbkdfIterations,
      pbkdfSalt: prepared.headerParams.pbkdfSalt,
      publicEncryptionJwk: prepared.headerParams.publicEncryptionJwk,
      publicEncryptionTag: prepared.headerParams.publicEncryptionTag,
    };

    // Step 3: Encode header as base64url
    const header = encodeJoseHeader(headerOptions);

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

    if (decoded.header.typ !== "JWE") {
      throw new JweError("Invalid token", {
        data: { typ: decoded.header.typ },
      });
    }

    if (this.kryptos.algorithm !== decoded.header.alg) {
      throw new JweError("Invalid token", {
        data: { alg: decoded.header.alg },
        debug: { expected: this.kryptos.algorithm },
      });
    }

    const header = parseTokenHeader<DecryptedJweHeader>(decoded.header);

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
        authTag,
        content,
        encryption: this.encryption,
        initialisationVector,
        pbkdfIterations,
        pbkdfSalt,
        publicEncryptionIv,
        publicEncryptionJwk,
        publicEncryptionKey,
        publicEncryptionTag,
      },
      { aad },
    );

    this.logger.debug("Token decrypted");

    return { header, payload, decoded, token };
  }

  // public static

  public static isJwe(jwe: string): boolean {
    return isJwe(jwe);
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
    if (isJws(input)) {
      return "application/jws";
    }

    if (isJwt(input)) {
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
