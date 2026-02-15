import { IKryptos } from "@lindorm/kryptos";
import { AesError } from "../../../errors";

type KeywrapEncryption =
  | "aes-128-ecb"
  | "aes-192-ecb"
  | "aes-256-ecb"
  | "aes-128-gcm"
  | "aes-192-gcm"
  | "aes-256-gcm";

export const calculateKeyWrapEncryption = (kryptos: IKryptos): KeywrapEncryption => {
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

    case "A128GCMKW":
    case "ECDH-ES+A128GCMKW":
      return "aes-128-gcm";

    case "A192GCMKW":
    case "ECDH-ES+A192GCMKW":
      return "aes-192-gcm";

    case "A256GCMKW":
    case "ECDH-ES+A256GCMKW":
      return "aes-256-gcm";

    default:
      throw new AesError("Unsupported keywrap encryption");
  }
};
