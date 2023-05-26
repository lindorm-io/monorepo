import { Algorithm, KeyPair } from "@lindorm-io/key-pair";

export const getHashAlgFromKey = (key: KeyPair): string => {
  switch (key.preferredAlgorithm) {
    case Algorithm.ES256:
    case Algorithm.RS256:
      return "sha256";

    case Algorithm.ES384:
    case Algorithm.RS384:
      return "sha384";

    case Algorithm.ES512:
    case Algorithm.RS512:
      return "sha512";

    default:
      throw new Error("Unsupported algorithm");
  }
};
