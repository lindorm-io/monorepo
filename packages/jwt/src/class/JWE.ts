import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "@lindorm-io/aes";
import { Logger } from "@lindorm-io/core-logger";
import { sanitiseToken } from "../util/public";
import { decryptJwe, encryptJwe } from "../util/public/jwe";

export type JweOptions = {
  algorithm?: AesAlgorithm;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  key: string;
};

export class JWE {
  private readonly algorithm: AesAlgorithm;
  private readonly encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm;
  private readonly key: string;
  private readonly logger: Logger;

  public constructor(options: JweOptions, logger: Logger) {
    this.logger = logger.createChildLogger(["JWE"]);

    this.algorithm = options.algorithm || AesAlgorithm.AES_256_GCM;
    this.encryptionKeyAlgorithm =
      options.encryptionKeyAlgorithm || AesEncryptionKeyAlgorithm.RSA_OAEP;
    this.key = options.key;
  }

  public encrypt(token: string): string {
    this.logger.debug("Encrypting token", {
      algorithm: this.algorithm,
      encryptionKeyAlgorithm: this.encryptionKeyAlgorithm,
      token: sanitiseToken(token),
    });

    const encrypted = encryptJwe({
      algorithm: this.algorithm,
      encryptionKeyAlgorithm: this.encryptionKeyAlgorithm,
      key: this.key,
      token,
    });

    this.logger.debug("Successfully encrypted token", { token: sanitiseToken(encrypted) });

    return encrypted;
  }

  public decrypt(jwe: string): string {
    this.logger.debug("Decrypting token", { token: sanitiseToken(jwe) });

    const decrypted = decryptJwe({ jwe, key: this.key });

    this.logger.debug("Successfully decrypted token", { token: sanitiseToken(decrypted) });

    return decrypted;
  }
}
