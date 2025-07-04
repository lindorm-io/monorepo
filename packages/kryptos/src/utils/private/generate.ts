import { Optional } from "@lindorm/types";
import { KryptosError } from "../../errors";
import { EcBuffer, KryptosAlgorithm, OctBuffer, OkpBuffer, RsaBuffer } from "../../types";
import { KryptosGenerate } from "../../types/private";
import { generateEcKey } from "./ec";
import { generateOctKey } from "./oct";
import { generateOkpKey } from "./okp";
import { generateRsaKey } from "./rsa";

type GenerateResult =
  | Omit<EcBuffer, "id" | "algorithm" | "type" | "use">
  | Omit<OctBuffer, "id" | "algorithm" | "type" | "use">
  | Omit<OkpBuffer, "id" | "algorithm" | "type" | "use">
  | Omit<RsaBuffer, "id" | "algorithm" | "type" | "use">;

export const generateKey = (options: KryptosGenerate): GenerateResult => {
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

type AutoResult = Omit<KryptosGenerate, "curve" | "encryption" | "operations"> &
  Optional<KryptosGenerate, "curve" | "encryption" | "operations">;

export const autoGenerateConfig = (algorithm: KryptosAlgorithm): AutoResult => {
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
        encryption: "A256GCM",
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
        encryption: "A256GCM",
        type: "EC",
        use: "enc",
      };

    case "EdDSA":
      return {
        algorithm,
        curve: "Ed25519",
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
        encryption: "A256GCM",
        type: "RSA",
        use: "enc",
      };

    default:
      throw new KryptosError("Invalid algorithm");
  }
};
