import { createECDH } from "crypto";
import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../../enums";
import { AesError } from "../../../errors";
import { AesEncryptionKey, AesPublicJwk } from "../../../types";
import { calculateSecretLength } from "../secret";
import { createKeyDerivation } from "./create-key-derivation";
import { getEcJwk } from "./get-ec-jwk";
import { getKeyCurve } from "./get-key-curve";
import { getJwkFromBuffer, getPrivateKeyBuffer, getPublicKeyBuffer } from "./jwk-buffer";

type EncryptOptions = {
  algorithm: AesAlgorithm;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  key: AesEncryptionKey;
};

type EncryptResult = {
  encryptionKey: Buffer;
  publicEncryptionJwk: AesPublicJwk;
};

type DecryptOptions = {
  algorithm: AesAlgorithm;
  key: AesEncryptionKey;
  publicEncryptionJwk: AesPublicJwk;
};

export const getEcEncryptionKeys = ({
  algorithm,
  encryptionKeyAlgorithm,
  key,
}: EncryptOptions): EncryptResult => {
  if (encryptionKeyAlgorithm !== AesEncryptionKeyAlgorithm.ECDH_ES) {
    throw new AesError("Mismatched options values", {
      description: "Encryption key algorithm is not ECDH_ES",
      debug: { encryptionKeyAlgorithm, key },
    });
  }

  const jwk = getEcJwk(key);
  const curve = getKeyCurve(jwk);
  const publicKey = getPublicKeyBuffer(jwk);
  const secretLength = calculateSecretLength(algorithm);

  const senderKeyPair = createECDH(curve);
  const senderPublicKey = senderKeyPair.generateKeys();

  const sharedSecret = senderKeyPair.computeSecret(publicKey);

  const encryptionKey = createKeyDerivation({
    initialKeyringMaterial: sharedSecret,
    length: secretLength,
  });

  const publicEncryptionJwk = getJwkFromBuffer(jwk.crv, senderPublicKey);

  return {
    encryptionKey,
    publicEncryptionJwk,
  };
};

export const getEcDecryptionKey = ({
  algorithm,
  key,
  publicEncryptionJwk,
}: DecryptOptions): Buffer => {
  const jwk = getEcJwk(key);
  const curve = getKeyCurve(jwk);
  const privateKey = getPrivateKeyBuffer(jwk);
  const publicKey = getPublicKeyBuffer(publicEncryptionJwk);
  const secretLength = calculateSecretLength(algorithm);

  const receiverKeyPair = createECDH(curve);
  receiverKeyPair.setPrivateKey(privateKey);

  const sharedSecret = receiverKeyPair.computeSecret(publicKey);

  return createKeyDerivation({
    initialKeyringMaterial: sharedSecret,
    length: secretLength,
  });
};
