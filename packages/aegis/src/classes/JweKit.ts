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
  TokenHeaderSignOptions,
} from "../types";
import { decodeJoseHeader, encodeJoseHeader, parseTokenHeader } from "../utils/private";

export class JweKit implements IJweKit {
  private readonly encryption: KryptosEncryption;
  private readonly logger: ILogger;
  private readonly kryptos: IKryptos;
  private readonly kryptosMayOverrideEncryption: boolean;

  public constructor(options: JweKitOptions) {
    this.logger = options.logger.child(["JweKit"]);
    this.kryptos = options.kryptos;

    this.encryption = options.encryption = "A256GCM";
    this.kryptosMayOverrideEncryption = options.kryptosMayOverrideEncryption ?? false;
  }

  public encrypt(data: string, options: JweEncryptOptions = {}): EncryptedJwe {
    const encryption =
      this.kryptosMayOverrideEncryption && this.kryptos.encryption
        ? this.kryptos.encryption
        : this.encryption;

    const objectId = options.objectId ?? randomUUID();

    const critical: Array<Exclude<keyof TokenHeaderSignOptions, "critical">> = [
      "algorithm",
      "encryption",
    ];

    const aes = new AesKit({ encryption, kryptos: this.kryptos });

    const {
      authTag,
      content,
      hkdfSalt,
      initialisationVector,
      pbkdfIterations,
      pbkdfSalt,
      publicEncryptionIv,
      publicEncryptionJwk,
      publicEncryptionKey,
      publicEncryptionTag,
    } = aes.encrypt(data, "record");

    if (publicEncryptionJwk) critical.push("publicEncryptionJwk");
    if (publicEncryptionIv) critical.push("publicEncryptionIv");
    if (publicEncryptionTag) critical.push("publicEncryptionTag");
    if (hkdfSalt) critical.push("hkdfSalt");
    if (pbkdfIterations) critical.push("pbkdfIterations");
    if (pbkdfSalt) critical.push("pbkdfSalt");

    const headerOptions: TokenHeaderSignOptions = {
      algorithm: this.kryptos.algorithm,
      contentType: this.contentType(data),
      critical,
      encryption,
      headerType: "JWE",
      hkdfSalt,
      jwksUri: this.kryptos.jwksUri,
      keyId: this.kryptos.id,
      objectId,
      pbkdfIterations,
      pbkdfSalt,
      publicEncryptionIv,
      publicEncryptionJwk,
      publicEncryptionTag,
    };

    const header = encodeJoseHeader(headerOptions);

    this.logger.silly("Token header encoded", { header, options: headerOptions });

    if (!authTag) {
      throw new JweError("Missing auth tag");
    }

    const token = [
      header,
      publicEncryptionKey ? B64.encode(publicEncryptionKey, B64U) : "",
      B64.encode(initialisationVector, B64U),
      B64.encode(content, B64U),
      B64.encode(authTag, B64U),
    ].join(".");

    this.logger.silly("Token created", { keyId: this.kryptos.id, token });

    return { token };
  }

  public decrypt(token: string): DecryptedJwe {
    const encryption =
      this.kryptosMayOverrideEncryption && this.kryptos.encryption
        ? this.kryptos.encryption
        : this.encryption;

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

    if (header.encryption !== encryption) {
      throw new JweError("Unexpected encryption", {
        debug: { actual: header.encryption, encryption },
      });
    }

    const authTag = B64.toBuffer(decoded.authTag);
    const content = B64.toBuffer(decoded.content);
    const hkdfSalt = header.hkdfSalt ? B64.toBuffer(header.hkdfSalt, B64U) : undefined;
    const initialisationVector = B64.toBuffer(decoded.initialisationVector);
    const pbkdfIterations = header.pbkdfIterations;
    const pbkdfSalt = header.pbkdfSalt ? B64.toBuffer(header.pbkdfSalt, B64U) : undefined;
    const publicEncryptionIv = header.publicEncryptionIv
      ? B64.toBuffer(header.publicEncryptionIv)
      : undefined;
    const publicEncryptionKey = decoded.publicEncryptionKey
      ? B64.toBuffer(decoded.publicEncryptionKey)
      : undefined;
    const publicEncryptionJwk = header.publicEncryptionJwk;
    const publicEncryptionTag = header.publicEncryptionTag
      ? B64.toBuffer(header.publicEncryptionTag)
      : undefined;

    if (header.critical.includes("publicEncryptionJwk") && !publicEncryptionJwk) {
      throw new JweError("Missing public encryption JWK");
    }
    if (header.critical.includes("publicEncryptionIv") && !publicEncryptionIv) {
      throw new JweError("Missing public encryption iv");
    }
    if (header.critical.includes("publicEncryptionTag") && !publicEncryptionTag) {
      throw new JweError("Missing public encryption tag");
    }
    if (header.critical.includes("hkdfSalt") && !hkdfSalt) {
      throw new JweError("Missing salt");
    }
    if (header.critical.includes("pbkdfIterations") && !pbkdfIterations) {
      throw new JweError("Missing iterations");
    }
    if (header.critical.includes("pbkdfSalt") && !pbkdfSalt) {
      throw new JweError("Missing salt");
    }

    const aes = new AesKit({ encryption, kryptos: this.kryptos });

    const payload = aes.decrypt({
      authTag,
      content,
      encryption,
      hkdfSalt,
      initialisationVector,
      pbkdfIterations,
      pbkdfSalt,
      publicEncryptionIv,
      publicEncryptionJwk,
      publicEncryptionKey,
      publicEncryptionTag,
    });

    this.logger.silly("Token decrypted", { payload });

    return { header, payload, decoded, token };
  }

  // public static

  public static isJwe(jwe: string): boolean {
    return isJwe(jwe);
  }

  public static decode(jwe: string): DecodedJwe {
    const [header, publicEncryptionKey, initialisationVector, content, authTag] =
      jwe.split(".");

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
