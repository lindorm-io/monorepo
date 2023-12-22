import { RsaPemValues } from "@lindorm-io/jwk";
import { privateDecrypt, privateEncrypt, publicDecrypt, publicEncrypt } from "crypto";
import { AesEncryptionKeyAlgorithm } from "../../../enums";
import { AesError } from "../../../errors";
import { getRsaHashKeyObject } from "./get-rsa-hash-key-object";
import { getRsaKeyObject } from "./get-rsa-key-object";

type EncryptOptions = {
  encryptionKey: Buffer;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  pem: RsaPemValues;
};

type DecryptOptions = {
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  pem: RsaPemValues;
  publicEncryptionKey: Buffer;
};

export const createPublicEncryptionKey = ({
  encryptionKey,
  encryptionKeyAlgorithm = AesEncryptionKeyAlgorithm.RSA_OAEP_256,
  pem,
}: EncryptOptions): Buffer => {
  if (pem.privateKey?.length) {
    return privateEncrypt(getRsaKeyObject(pem), encryptionKey);
  }

  if (pem.publicKey?.length) {
    return publicEncrypt(getRsaHashKeyObject(pem, encryptionKeyAlgorithm), encryptionKey);
  }

  throw new AesError("Unable to encrypt AES cipher with public key without public key", {
    description: "Public key is missing",
    debug: { pem },
  });
};

export const decryptPublicEncryptionKey = ({
  encryptionKeyAlgorithm = AesEncryptionKeyAlgorithm.RSA_OAEP_256,
  pem,
  publicEncryptionKey,
}: DecryptOptions): Buffer => {
  if (pem.privateKey?.length) {
    return privateDecrypt(getRsaHashKeyObject(pem, encryptionKeyAlgorithm), publicEncryptionKey);
  }

  if (pem.publicKey?.length) {
    return publicDecrypt(getRsaKeyObject(pem), publicEncryptionKey);
  }

  throw new AesError("Unable to decrypt AES cipher with public key without public key", {
    description: "Public key is missing",
    debug: { pem },
  });
};
