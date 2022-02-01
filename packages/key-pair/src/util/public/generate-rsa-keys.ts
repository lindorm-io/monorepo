import { Algorithm, KeyType } from "../../enum";
import { generateKeyPair } from "crypto";

interface IOptions {
  modulusLength?: 1 | 2 | 3 | 4;
  passphrase?: string;
}

export interface IGenerateRSAKeysData {
  algorithms: Array<Algorithm>;
  passphrase: string;
  privateKey: string;
  publicKey: string;
  type: KeyType;
}

export const generateRsaKeys = async (options: IOptions = {}): Promise<IGenerateRSAKeysData> => {
  const { modulusLength = 4, passphrase = "" } = options;

  return new Promise((resolve, reject) => {
    generateKeyPair(
      "rsa",
      {
        modulusLength: modulusLength * 1024,
        publicKeyEncoding: {
          type: "pkcs1",
          format: "pem",
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem",
          cipher: "aes-256-cbc",
          passphrase,
        },
      },
      (err, publicKey, privateKey) => {
        if (err) reject(err);

        resolve({
          algorithms: [Algorithm.RS256, Algorithm.RS384, Algorithm.RS512],
          passphrase,
          privateKey,
          publicKey,
          type: KeyType.RSA,
        });
      },
    );
  });
};
