import { Algorithm, KeyType, NamedCurve } from "../../enum";
import { generateKeyPair } from "crypto";

interface IOptions {
  namedCurve?: NamedCurve;
}

export interface IGenerateECCKeysData {
  algorithms: Array<Algorithm>;
  namedCurve: NamedCurve;
  privateKey: string;
  publicKey: string;
  type: KeyType;
}

const getAlgorithm = (namedCurve: NamedCurve): Algorithm => {
  switch (namedCurve) {
    case NamedCurve.P521:
      return Algorithm.ES512;

    case NamedCurve.P384:
      return Algorithm.ES384;

    case NamedCurve.P256:
      return Algorithm.ES256;

    default:
      throw new Error("Invalid Named Curve");
  }
};

export const generateEcKeys = async (options: IOptions = {}): Promise<IGenerateECCKeysData> => {
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
          type: KeyType.EC,
        });
      },
    );
  });
};
