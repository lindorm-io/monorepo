import { Optional } from "@lindorm/types";
import { KryptosError } from "../../errors";
import { EcDer, KryptosAlgorithm, OctDer, OkpDer, RsaDer } from "../../types";
import { KryptosMake } from "../../types/private";
import { generateEcKey } from "./ec";
import { generateOctKey } from "./oct";
import { generateOkpKey } from "./okp";
import { generateRsaKey } from "./rsa";

type MakeResult =
  | Omit<EcDer, "algorithm" | "type" | "use">
  | Omit<OctDer, "algorithm" | "type" | "use">
  | Omit<OkpDer, "algorithm" | "type" | "use">
  | Omit<RsaDer, "algorithm" | "type" | "use">;

export const makeKey = (options: KryptosMake): MakeResult => {
  switch (options.type) {
    case "EC":
      return generateEcKey(options);

    case "oct":
      return generateOctKey(options);

    case "OKP":
      return generateOkpKey(options);

    case "RSA":
      return generateRsaKey(options);

    default:
      throw new KryptosError("Invalid key type");
  }
};

type AutoResult = Omit<KryptosMake, "curve" | "encryption" | "operations"> &
  Optional<KryptosMake, "curve" | "encryption" | "operations">;

export const autoMakeConfig = (algorithm: KryptosAlgorithm): AutoResult => {
  switch (algorithm) {
    case "A128KW":
    case "A192KW":
    case "A256KW":
    case "A128GCMKW":
    case "A192GCMKW":
    case "A256GCMKW":
    case "PBES2-HS256+A128KW":
    case "PBES2-HS384+A192KW":
    case "PBES2-HS512+A256KW":
      return {
        algorithm,
        type: "oct",
        use: "enc",
      };

    case "dir":
      return {
        algorithm,
        encryption: "A256GCM",
        type: "oct",
        use: "enc",
      };

    case "ECDH-ES":
      return {
        algorithm,
        curve: "X448",
        type: "OKP",
        use: "enc",
      };

    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW":
    case "ECDH-ES+A128GCMKW":
    case "ECDH-ES+A192GCMKW":
    case "ECDH-ES+A256GCMKW":
      return {
        algorithm,
        type: "EC",
        use: "enc",
      };

    case "EdDSA":
      return {
        algorithm,
        curve: "Ed448",
        type: "OKP",
        use: "sig",
      };

    case "ES256":
      return {
        algorithm,
        curve: "P-256",
        type: "EC",
        use: "sig",
      };

    case "ES384":
      return {
        algorithm,
        curve: "P-384",
        type: "EC",
        use: "sig",
      };

    case "ES512":
      return {
        algorithm,
        curve: "P-521",
        type: "EC",
        use: "sig",
      };

    case "HS256":
    case "HS384":
    case "HS512":
      return {
        algorithm,
        type: "oct",
        use: "sig",
      };

    case "PS256":
    case "PS384":
    case "PS512":
    case "RS256":
    case "RS384":
    case "RS512":
      return {
        algorithm,
        type: "RSA",
        use: "sig",
      };

    case "RSA-OAEP-256":
    case "RSA-OAEP-384":
    case "RSA-OAEP-512":
    case "RSA-OAEP":
      return {
        algorithm,
        type: "RSA",
        use: "enc",
      };

    default:
      throw new KryptosError("Invalid algorithm");
  }
};
