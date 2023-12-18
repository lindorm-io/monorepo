import { AesAlgorithm } from "@lindorm-io/aes";
import { JweEncoding } from "../../enum";
import { TokenError } from "../../error";

export const mapJweEncodingToAesAlgorithm = (encoding: string): AesAlgorithm => {
  switch (encoding) {
    case JweEncoding.A128CBC_HS256:
      return AesAlgorithm.AES_128_CBC_HS256;

    case JweEncoding.A192CBC_HS256:
      return AesAlgorithm.AES_192_CBC_HS256;

    case JweEncoding.A256CBC_HS256:
      return AesAlgorithm.AES_256_CBC_HS256;

    case JweEncoding.A128GCM:
      return AesAlgorithm.AES_128_GCM;

    case JweEncoding.A192GCM:
      return AesAlgorithm.AES_192_GCM;

    case JweEncoding.A256GCM:
      return AesAlgorithm.AES_256_GCM;

    default:
      throw new TokenError("Invalid JWE encoding", {
        debug: { encoding },
      });
  }
};

export const mapAesAlgorithmToJweEncoding = (algorithm: string): JweEncoding => {
  switch (algorithm) {
    case AesAlgorithm.AES_128_CBC_HS256:
      return JweEncoding.A128CBC_HS256;

    case AesAlgorithm.AES_192_CBC_HS256:
      return JweEncoding.A192CBC_HS256;

    case AesAlgorithm.AES_256_CBC_HS256:
      return JweEncoding.A256CBC_HS256;

    case AesAlgorithm.AES_128_GCM:
      return JweEncoding.A128GCM;

    case AesAlgorithm.AES_192_GCM:
      return JweEncoding.A192GCM;

    case AesAlgorithm.AES_256_GCM:
      return JweEncoding.A256GCM;

    default:
      throw new TokenError("Invalid algorithm", {
        debug: { algorithm },
      });
  }
};
