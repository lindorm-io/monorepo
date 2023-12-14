import { RSAKeyPairOptions, generateKeyPair } from "crypto";
import { GenerateRsaKeysOptions, GenerateRsaKeysResult } from "../types";

export const generateRsaKeys = async (
  options: GenerateRsaKeysOptions = {},
): Promise<GenerateRsaKeysResult> => {
  const { modulus = 4, passphrase } = options;

  const keyPairOptions: RSAKeyPairOptions<"pem", "pem"> = {
    modulusLength: modulus * 1024,
    publicKeyEncoding: {
      format: "pem",
      type: "pkcs1",
    },
    privateKeyEncoding: passphrase
      ? {
          cipher: "aes-256-cbc",
          format: "pem",
          passphrase,
          type: "pkcs8",
        }
      : {
          format: "pem",
          type: "pkcs1",
        },
  };

  return new Promise((resolve, reject) =>
    generateKeyPair("rsa", keyPairOptions, (err, publicKey, privateKey) =>
      err ? reject(err) : resolve({ publicKey, privateKey }),
    ),
  );
};
