import { WebKeySet } from "@lindorm-io/jwk";

export const getHashAlgFromKey = (key: WebKeySet): string => {
  switch (key.algorithm) {
    case "ES256":
    case "RS256":
      return "sha256";

    case "ES384":
    case "RS384":
      return "sha384";

    case "ES512":
    case "RS512":
      return "sha512";

    default:
      throw new Error("Unsupported algorithm");
  }
};
