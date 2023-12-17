import { AesAlgorithm, RsaOaepHash } from "@lindorm-io/aes";
import { Logger } from "@lindorm-io/core-logger";
import { sanitiseToken } from "../util/public";
import { decryptJwe, encryptJwe } from "../util/public/jwe";

export type JweOptions = {
  algorithm?: AesAlgorithm;
  key: string;
  oaepHash?: RsaOaepHash;
};

export class JWE {
  private readonly algorithm: AesAlgorithm;
  private readonly key: string;
  private readonly logger: Logger;
  private readonly oaepHash: RsaOaepHash;

  public constructor(options: JweOptions, logger: Logger) {
    this.logger = logger.createChildLogger(["JWE"]);

    this.key = options.key;

    this.algorithm = options.algorithm || AesAlgorithm.AES_256_GCM;
    this.oaepHash = options.oaepHash || RsaOaepHash.SHA1;
  }

  public encrypt(token: string): string {
    this.logger.debug("Encrypting token", {
      algorithm: this.algorithm,
      token: sanitiseToken(token),
      oaepHash: this.oaepHash,
    });

    const encrypted = encryptJwe({
      algorithm: this.algorithm,
      token,
      key: this.key,
      oaepHash: this.oaepHash,
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
