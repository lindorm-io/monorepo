import { Kryptos } from "@lindorm/kryptos";
import { pbkdf2Sync, randomBytes } from "crypto";
import { AesError } from "../../../errors";
import { AesEncryption } from "../../../types";
import { _calculateEncryptionKeyLength } from "../encryption-keys/calculate-encryption-key-length";

type EncryptOptions = {
  encryption: AesEncryption;
  kryptos: Kryptos;
};

type EncryptResult = {
  encryptionKey: Buffer;
  iterations: number;
  salt: Buffer;
};

type DecryptOptions = {
  encryption: AesEncryption;
  iterations: number;
  kryptos: Kryptos;
  salt: Buffer;
};

export const _getOctEncryptionKeys = ({
  encryption,
  kryptos,
}: EncryptOptions): EncryptResult => {
  const der = kryptos.export("der");

  if (!der.privateKey) {
    throw new AesError("Unable to encrypt AES without private key");
  }

  const salt = randomBytes(16); // Generate a random salt
  const length = _calculateEncryptionKeyLength(encryption);
  const iterations = 100000;

  const encryptionKey = pbkdf2Sync(der.privateKey, salt, iterations, length, "SHA256");

  return { encryptionKey, iterations, salt };
};

export const _getOctDecryptionKey = ({
  encryption,
  iterations,
  kryptos,
  salt,
}: DecryptOptions): Buffer => {
  const der = kryptos.export("der");

  if (!der.privateKey) {
    throw new AesError("Unable to decrypt AES without private key");
  }

  const length = _calculateEncryptionKeyLength(encryption);

  return pbkdf2Sync(der.privateKey, salt, iterations, length, "SHA256");
};
