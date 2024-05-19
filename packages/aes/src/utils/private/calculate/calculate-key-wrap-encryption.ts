import { IKryptos } from "@lindorm/kryptos";

type KeywrapEncryption = "aes-128-ecb" | "aes-192-ecb" | "aes-256-ecb";

export const _calculateKeyWrapEncryption = (kryptos: IKryptos): KeywrapEncryption => {
  switch (kryptos.algorithm) {
    case "A128KW":
    case "ECDH-ES+A128KW":
    case "PBES2-HS256+A128KW":
      return "aes-128-ecb";

    case "A192KW":
    case "ECDH-ES+A192KW":
    case "PBES2-HS384+A192KW":
      return "aes-192-ecb";

    case "A256KW":
    case "ECDH-ES+A256KW":
    case "PBES2-HS512+A256KW":
      return "aes-256-ecb";

    default:
      throw new Error("Unsupported keywrap encryption");
  }
};
