import { AesEncryption, Encryption } from "@lindorm-io/aes";
import { JweEncoding } from "../../enum";
import { TokenError } from "../../error";

export const mapJweEncodingToEncryption = (encoding: string): Encryption => {
  switch (encoding) {
    case JweEncoding.A128CBC_HS256:
      return AesEncryption.AES_128_CBC;

    case JweEncoding.A192CBC_HS256:
      return AesEncryption.AES_192_CBC;

    case JweEncoding.A256CBC_HS256:
      return AesEncryption.AES_256_CBC;

    case JweEncoding.A128GCM:
      return AesEncryption.AES_128_GCM;

    case JweEncoding.A192GCM:
      return AesEncryption.AES_192_GCM;

    case JweEncoding.A256GCM:
      return AesEncryption.AES_256_GCM;

    default:
      throw new TokenError("Invalid JWE encoding", {
        debug: { encoding },
      });
  }
};

export const mapEncryptionToJweEncoding = (encryption: string): JweEncoding => {
  switch (encryption) {
    case AesEncryption.AES_128_CBC:
      return JweEncoding.A128CBC_HS256;

    case AesEncryption.AES_192_CBC:
      return JweEncoding.A192CBC_HS256;

    case AesEncryption.AES_256_CBC:
      return JweEncoding.A256CBC_HS256;

    case AesEncryption.AES_128_GCM:
      return JweEncoding.A128GCM;

    case AesEncryption.AES_192_GCM:
      return JweEncoding.A192GCM;

    case AesEncryption.AES_256_GCM:
      return JweEncoding.A256GCM;

    default:
      throw new TokenError("Invalid algorithm", {
        debug: { algorithm: encryption },
      });
  }
};
