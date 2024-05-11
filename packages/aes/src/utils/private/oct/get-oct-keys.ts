import { Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { Encryption } from "../../../types";
import { _createKeyDerivation } from "../secret/create-key-derivation";

type EncryptOptions = {
  encryption: Encryption;
  kryptos: Kryptos;
};

type EncryptResult = {
  encryptionKey: Buffer;
};

export const _getOctEncryptionKeys = ({ encryption, kryptos }: EncryptOptions): EncryptResult => {
  const der = kryptos.export("der");

  if (!der.privateKey) {
    throw new AesError("Unable to encrypt AES without private key");
  }

  return {
    encryptionKey: _createKeyDerivation({ encryption, initialKeyringMaterial: der.privateKey }),
  };
};

export const _getOctDecryptionKey = ({ encryption, kryptos }: EncryptOptions): Buffer => {
  const der = kryptos.export("der");

  if (!der.privateKey) {
    throw new AesError("Unable to decrypt AES without private key");
  }

  return _createKeyDerivation({ encryption, initialKeyringMaterial: der.privateKey });
};
