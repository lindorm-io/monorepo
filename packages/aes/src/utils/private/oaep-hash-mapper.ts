import { RsaOaepHash, ShaAlgorithm } from "../../enums";
import { AesError } from "../../errors";

export const mapRsaOaepHashToShaAlgorithm = (hash: RsaOaepHash): ShaAlgorithm => {
  switch (hash) {
    case RsaOaepHash.SHA1:
      return ShaAlgorithm.SHA1;

    case RsaOaepHash.SHA256:
      return ShaAlgorithm.SHA256;

    case RsaOaepHash.SHA384:
      return ShaAlgorithm.SHA384;

    case RsaOaepHash.SHA512:
      return ShaAlgorithm.SHA512;

    default:
      throw new AesError("Unexpected RSA OAEP hash", {
        debug: { hash },
      });
  }
};

export const mapStringToRsaOaepHash = (hash: string): RsaOaepHash => {
  switch (hash) {
    case "rsa-oaep":
      return RsaOaepHash.SHA1;

    case "rsa-oaep-256":
      return RsaOaepHash.SHA256;

    case "rsa-oaep-384":
      return RsaOaepHash.SHA384;

    case "rsa-oaep-512":
      return RsaOaepHash.SHA512;

    default:
      throw new AesError("Unexpected key hash", {
        debug: { hash },
      });
  }
};
