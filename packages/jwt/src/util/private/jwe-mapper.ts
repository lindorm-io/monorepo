import { AesAlgorithm } from "@lindorm-io/aes";
import { JweEncoding } from "../../enum";
import { TokenError } from "../../error";

export const mapJweEncodingToAlgorithm = (encoding: string): AesAlgorithm => {
  switch (encoding) {
    case JweEncoding.A128GCM:
      return AesAlgorithm.AES_128_GCM;

    case JweEncoding.A192GCM:
      return AesAlgorithm.AES_192_GCM;

    case JweEncoding.A256GCM:
      return AesAlgorithm.AES_256_GCM;

    default:
      throw new TokenError("Invalid JWE encoding");
  }
};

export const mapAlgorithmToJweEncoding = (algorithm: string): JweEncoding => {
  switch (algorithm) {
    case AesAlgorithm.AES_128_GCM:
      return JweEncoding.A128GCM;

    case AesAlgorithm.AES_192_GCM:
      return JweEncoding.A192GCM;

    case AesAlgorithm.AES_256_GCM:
      return JweEncoding.A256GCM;

    default:
      throw new TokenError("Invalid algorithm");
  }
};
