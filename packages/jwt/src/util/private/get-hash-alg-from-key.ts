import { KeyPair, KeyPairAlgorithm } from "@lindorm-io/key-pair";

export const getHashAlgFromKey = (key: KeyPair): string => {
  switch (key.preferredAlgorithm) {
    case KeyPairAlgorithm.ES256:
    case KeyPairAlgorithm.RS256:
      return "sha256";

    case KeyPairAlgorithm.ES384:
    case KeyPairAlgorithm.RS384:
      return "sha384";

    case KeyPairAlgorithm.ES512:
    case KeyPairAlgorithm.RS512:
      return "sha512";

    default:
      throw new Error("Unsupported algorithm");
  }
};
