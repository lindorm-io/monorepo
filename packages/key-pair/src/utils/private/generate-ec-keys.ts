import { generateKeyPair } from "crypto";
import { KeyPairAlgorithm, KeyPairType, NamedCurve } from "../../enums";

export type GenerateEcKeysOptions = {
  namedCurve?: NamedCurve;
};

export type GenerateEcKeysData = {
  algorithms: Array<KeyPairAlgorithm>;
  namedCurve: NamedCurve;
  privateKey: string;
  publicKey: string;
  type: KeyPairType;
};

const getAlgorithm = (namedCurve: NamedCurve): KeyPairAlgorithm => {
  switch (namedCurve) {
    case NamedCurve.P521:
      return KeyPairAlgorithm.ES512;

    case NamedCurve.P384:
      return KeyPairAlgorithm.ES384;

    case NamedCurve.P256:
      return KeyPairAlgorithm.ES256;

    default:
      throw new Error("Invalid Named Curve");
  }
};

export const generateEcKeys = async (
  options: GenerateEcKeysOptions = {},
): Promise<GenerateEcKeysData> => {
  const { namedCurve = NamedCurve.P521 } = options;

  const algorithm = getAlgorithm(namedCurve);

  return new Promise((resolve, reject) => {
    generateKeyPair(
      "ec",
      {
        namedCurve,
        publicKeyEncoding: {
          type: "spki",
          format: "pem",
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem",
        },
      },
      (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
        }
        resolve({
          algorithms: [algorithm],
          namedCurve,
          privateKey,
          publicKey,
          type: KeyPairType.EC,
        });
      },
    );
  });
};
