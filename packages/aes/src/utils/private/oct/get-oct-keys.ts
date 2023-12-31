import { OctKeySet } from "@lindorm-io/jwk";
import { Encryption } from "../../../types";
import { assertSecretLength } from "../secret";

type EncryptOptions = {
  encryption: Encryption;
  keySet: OctKeySet;
};

type EncryptResult = {
  encryptionKey: Buffer;
};

export const getOctEncryptionKeys = ({ encryption, keySet }: EncryptOptions): EncryptResult => {
  const der = keySet.export("der");
  const pem = keySet.export("pem");

  assertSecretLength({ encryption, secret: pem.privateKey });

  return { encryptionKey: der.privateKey };
};

export const getOctDecryptionKey = ({ encryption, keySet }: EncryptOptions): Buffer => {
  const der = keySet.export("der");
  const pem = keySet.export("pem");

  assertSecretLength({ encryption, secret: pem.privateKey });

  return der.privateKey;
};
