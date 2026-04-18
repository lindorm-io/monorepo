import { KryptosError } from "../../errors";
import {
  AkpBuffer,
  EcBuffer,
  KryptosAlgorithm,
  OctBuffer,
  OkpBuffer,
  RsaBuffer,
  RsaModulus,
} from "../../types";
import { KryptosGenerate } from "../types/generate";
import { generateAkpKey, generateAkpKeyAsync } from "./akp/generate-key";
import { generateEcKey, generateEcKeyAsync } from "./ec/generate-key";
import { generateOctKey, generateOctKeyAsync } from "./oct/generate-key";
import { generateOkpKey, generateOkpKeyAsync } from "./okp/generate-key";
import { generateRsaKey, generateRsaKeyAsync } from "./rsa/generate-key";

type GenerateResult =
  | Omit<AkpBuffer, "id" | "algorithm" | "type" | "use">
  | Omit<EcBuffer, "id" | "algorithm" | "type" | "use">
  | Omit<OctBuffer, "id" | "algorithm" | "type" | "use">
  | Omit<OkpBuffer, "id" | "algorithm" | "type" | "use">
  | (Omit<RsaBuffer, "id" | "algorithm" | "type" | "use"> & { modulus: RsaModulus });

export const generateKey = (options: KryptosGenerate): GenerateResult => {
  switch (options.type) {
    case "AKP":
      return generateAkpKey(options);

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

export const generateKeyAsync = async (
  options: KryptosGenerate,
): Promise<GenerateResult> => {
  switch (options.type) {
    case "AKP":
      return generateAkpKeyAsync(options);

    case "EC":
      return generateEcKeyAsync(options);

    case "oct":
      return generateOctKeyAsync(options);

    case "OKP":
      return generateOkpKeyAsync(options);

    case "RSA":
      return generateRsaKeyAsync(options);

    default:
      throw new KryptosError("Invalid key type");
  }
};

type AutoResult = KryptosGenerate;

export const autoGenerateConfig = (algorithm: KryptosAlgorithm): AutoResult => {
  switch (algorithm) {
    case "ML-DSA-44":
    case "ML-DSA-65":
    case "ML-DSA-87":
      return {
        algorithm,
        type: "AKP",
        use: "sig",
      };

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
        encryption: "A256GCM",
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
    case "ECDH-ES+A128KW":
    case "ECDH-ES+A128GCMKW":
      return {
        algorithm,
        curve: "X25519",
        encryption: "A256GCM",
        type: "OKP",
        use: "enc",
      };

    case "ECDH-ES+A192KW":
    case "ECDH-ES+A192GCMKW":
    case "ECDH-ES+A256KW":
    case "ECDH-ES+A256GCMKW":
      return {
        algorithm,
        curve: "X448",
        encryption: "A256GCM",
        type: "OKP",
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
