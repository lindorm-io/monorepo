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
  TokenHeaderAlgorithm,
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

    // Step 1: Prepare encryption (key management only — no content encrypted yet)
    const prepared = kit.prepareEncryption();

    // Step 2: Build the CBOR-encoded protected header
    // RFC 9052: protected header alg = content encryption algorithm
    const protectedHeader = mapCoseHeader(
      mapTokenHeader({
        algorithm: this.encryption as TokenHeaderAlgorithm,
        contentType: this.contentType(data),
        headerType: "application/cose; cose-type=cose-encrypt",
      }),
    );
    const protectedCbor = encode(protectedHeader);

    // Step 3: Compute AAD from the CBOR-encoded protected header
    const aad = protectedCbor;

    // Step 4: Encrypt content with AAD
    const { authTag, content, initialisationVector } = prepared.encrypt(data, { aad });

    // Step 5: Assemble the COSE structure
    const unprotectedHeader = mapCoseHeader(
      mapTokenHeader({
        ...(options.header ?? {}),
        initialisationVector,
        objectId,
      }),
    );

    const ciphertext = Buffer.concat([content, authTag]);

    // RFC 9052: recipient header alg = key management algorithm
    const recipientHeader = mapCoseHeader(
      mapTokenHeader({
        algorithm: this.kryptos.algorithm,
        keyId: this.kryptos.id,
        publicEncryptionJwk: prepared.headerParams.publicEncryptionJwk,
      }),
    );
    const recipientPublicKey = prepared.publicEncryptionKey ?? null;
    const recipients = [[encode(new Map()), recipientHeader, recipientPublicKey]];

    const buffer = encode([protectedCbor, unprotectedHeader, ciphertext, recipients]);
    const token = buffer.toString("base64url");

    this.logger.debug("Token encrypted", { token });

    return { buffer, token };
  }

  public decrypt<T extends CweContent = string>(token: CweContent): DecryptedCwe<T> {
    const kit = new AesKit({ encryption: this.encryption, kryptos: this.kryptos });

    this.logger.debug("Decrypting token", { token });

    const decoded = CweKit.decode(token);

    // RFC 9052: protected alg = content encryption algorithm
    if (this.encryption !== decoded.protected.alg) {
      throw new CoseEncryptError("Invalid content encryption", {
        debug: {
          expect: this.encryption,
          actual: decoded.protected.alg,
        },
      });
    }

    // RFC 9052: recipient alg = key management algorithm
    if (this.kryptos.algorithm !== decoded.recipient.unprotected.alg) {
      throw new CoseEncryptError("Invalid key management algorithm", {
        debug: {
          expect: this.kryptos.algorithm,
          actual: decoded.recipient.unprotected.alg,
        },
      });
    }

    const initialisationVector = decoded.unprotected.iv;
    const publicEncryptionJwk = decoded.recipient.unprotected.epk;
    const publicEncryptionKey = decoded.recipient.publicEncryptionKey;

    if (!initialisationVector) {
      throw new CoseEncryptError("Missing iv");
    }

    // RFC 9052: protected alg is content encryption (KryptosEncryption), which
    // is outside TokenHeaderAlgorithm. We cast the input/output across the boundary.
    const header = parseTokenHeader({
      ...(decoded.protected as any),
      epk: decoded.recipient.unprotected.epk,
      kid: decoded.recipient.unprotected.kid,
      oid: decoded.unprotected.oid,
    }) as unknown as DecryptedCweHeader;

    // RFC 7515 Section 4.1.11: reject any critical extension params we don't understand
    if (header.critical?.length) {
      for (const param of header.critical) {
        throw new CoseEncryptError(`Unsupported critical header parameter: ${param}`);
      }
    }

    // Reconstruct AAD from the CBOR-encoded protected header
    const aad = decoded.protectedCbor;

    // RFC 9052: protected alg is content encryption, use it for the decryption record
    const payload = kit.decrypt<T>(
      {
        authTag: decoded.authTag,
        content: decoded.content,
        contentType: (decoded.protected.cty as AesContentType) ?? "text/plain",
        encryption: decoded.protected.alg,
        initialisationVector,
        publicEncryptionJwk,
        publicEncryptionKey,
      } satisfies AesDecryptionRecord,
      { aad },
    );

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

    // RFC 9052: content encryption algorithm is in the protected header
    const length = authTagLength(protectedDict.alg as KryptosEncryption);
    const authTag = ciphertext.slice(-length);
    const content = ciphertext.slice(0, -length);

    return {
      protected: protectedDict as any,
      protectedCbor: Buffer.isBuffer(protectedCbor)
        ? protectedCbor
        : Buffer.from(protectedCbor),
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
