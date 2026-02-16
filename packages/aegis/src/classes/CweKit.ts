import { AesContentType, AesDecryptionRecord, AesKit } from "@lindorm/aes";
import { isBuffer, isString } from "@lindorm/is";
import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { decode, encode } from "cbor";
import { randomBytes } from "crypto";
import { CoseEncryptError } from "../errors";
import { ICweKit } from "../interfaces";
import {
  CweContent,
  CweEncryptOptions,
  CweKitOptions,
  DecodedCwe,
  DecryptedCwe,
  DecryptedCweHeader,
  EncryptedCwe,
} from "../types";
import {
  authTagLength,
  decodeCoseHeader,
  mapCoseHeader,
  mapTokenHeader,
  parseTokenHeader,
} from "../utils/private";

export class CweKit implements ICweKit {
  private readonly encryption: KryptosEncryption;
  private readonly logger: ILogger;
  private readonly kryptos: IKryptos;

  public constructor(options: CweKitOptions) {
    this.logger = options.logger.child(["CoseEncryptKit"]);
    this.kryptos = options.kryptos;
    this.encryption = options.encryption ?? options.kryptos.encryption ?? "A256GCM";
  }

  public encrypt(data: CweContent, options: CweEncryptOptions = {}): EncryptedCwe {
    const kit = new AesKit({ encryption: this.encryption, kryptos: this.kryptos });

    this.logger.debug("Encrypting token", { options });

    const objectId = options.objectId ?? randomBytes(20).toString("base64url");

    const {
      authTag,
      content,
      initialisationVector,
      pbkdfIterations,
      pbkdfSalt,
      publicEncryptionIv,
      publicEncryptionJwk,
      publicEncryptionKey,
      publicEncryptionTag,
    } = kit.encrypt(data, "record");

    const protectedHeader = mapCoseHeader(
      mapTokenHeader({
        algorithm: this.kryptos.algorithm,
        contentType: this.contentType(data),
        headerType: "application/cose; cose-type=cose-encrypt",
      }),
    );
    const protectedCbor = encode(protectedHeader);

    const unprotectedHeader = mapCoseHeader(
      mapTokenHeader({
        ...(options.header ?? {}),
        initialisationVector,
        objectId,
      }),
    );

    const ciphertext = Buffer.concat([content, authTag]);

    const recipientHeader = mapCoseHeader(
      mapTokenHeader({
        encryption: this.encryption,
        initialisationVector: publicEncryptionIv,
        jwksUri: this.kryptos.jwksUri ?? undefined,
        keyId: this.kryptos.id,
        pbkdfIterations,
        pbkdfSalt,
        publicEncryptionJwk,
        publicEncryptionTag,
      }),
    );
    const recipientPublicKey = publicEncryptionKey ?? null;
    const recipients = [[encode({}), recipientHeader, recipientPublicKey]];

    const buffer = encode([protectedCbor, unprotectedHeader, ciphertext, recipients]);
    const token = buffer.toString("base64url");

    this.logger.debug("Token encrypted", { token });

    return { buffer, token };
  }

  public decrypt<T extends CweContent = string>(token: CweContent): DecryptedCwe<T> {
    const kit = new AesKit({ encryption: this.encryption, kryptos: this.kryptos });

    this.logger.debug("Decrypting token", { token });

    const decoded = CweKit.decode(token);

    if (this.kryptos.algorithm !== decoded.protected.alg) {
      throw new CoseEncryptError("Invalid token", {
        debug: {
          expect: this.kryptos.algorithm,
          actual: decoded.protected.alg,
        },
      });
    }

    if (decoded.recipient.unprotected.enc !== this.encryption) {
      throw new CoseEncryptError("Unexpected encryption", {
        debug: {
          expect: this.encryption,
          actual: decoded.recipient.unprotected.enc,
        },
      });
    }

    const initialisationVector = decoded.unprotected.iv;
    const pbkdfIterations = decoded.recipient.unprotected.p2c;
    const pbkdfSalt = decoded.recipient.unprotected.p2s;
    const publicEncryptionIv = decoded.recipient.unprotected.iv;
    const publicEncryptionJwk = decoded.recipient.unprotected.epk;
    const publicEncryptionTag = decoded.recipient.unprotected.tag;
    const publicEncryptionKey = decoded.recipient.publicEncryptionKey;

    if (!initialisationVector) {
      throw new CoseEncryptError("Missing iv");
    }

    const header = parseTokenHeader<DecryptedCweHeader>({
      ...decoded.protected,
      enc: decoded.recipient.unprotected.enc,
      epk: decoded.recipient.unprotected.epk,
      jku: decoded.recipient.unprotected.jku,
      kid: decoded.recipient.unprotected.kid,
      oid: decoded.unprotected.oid,
    });

    // RFC 7515 Section 4.1.11: reject any critical extension params we don't understand
    if (header.critical?.length) {
      for (const param of header.critical) {
        throw new CoseEncryptError(`Unsupported critical header parameter: ${param}`);
      }
    }

    const payload = kit.decrypt<T>({
      authTag: decoded.authTag,
      content: decoded.content,
      contentType: (decoded.protected.cty as AesContentType) ?? "text/plain",
      encryption: this.encryption,
      initialisationVector,
      pbkdfIterations,
      pbkdfSalt,
      publicEncryptionIv,
      publicEncryptionJwk,
      publicEncryptionKey,
      publicEncryptionTag,
    } satisfies AesDecryptionRecord);

    this.logger.debug("Token decrypted");

    return {
      decoded,
      header,
      payload,
      token: isString(token) ? token : token.toString("base64url"),
    };
  }

  // public static

  public static isCwe(token: Buffer | string): boolean {
    try {
      const decode = CweKit.decode(token);
      return decode.protected.typ === "application/cose; cose-type=cose-encrypt";
    } catch {
      return false;
    }
  }

  public static decode(token: CweContent): DecodedCwe {
    const [protectedCbor, unprotectedCose, ciphertext, recipients] = decode(
      isBuffer(token) ? token : Buffer.from(token, "base64url"),
    );

    const protectedDict = decodeCoseHeader(decode(protectedCbor));
    const unprotectedDict = decodeCoseHeader(unprotectedCose);

    const [recipient] = recipients;
    const [_, recipientHeader, publicEncryptionKey] = recipient;
    const recipientDict = decodeCoseHeader(recipientHeader);

    const length = authTagLength(recipientDict.enc!);
    const authTag = ciphertext.slice(-length);
    const content = ciphertext.slice(0, -length);

    return {
      protected: protectedDict as any,
      unprotected: unprotectedDict as any,
      recipient: {
        unprotected: recipientDict as any,
        initialisationVector: recipientDict.iv,
        publicEncryptionKey,
      },
      initialisationVector: unprotectedDict.iv!,
      content,
      authTag,
    };
  }

  // private

  private contentType(input: CweContent): string {
    if (isBuffer(input)) {
      return "application/octet-stream";
    }
    return "text/plain";
  }
}
