import { IKryptos } from "@lindorm/kryptos";
import { createCipheriv, createDecipheriv } from "crypto";
import { _calculateKeywrapEncryption } from "./calculate-keywrap-encryption";

const AIV = "A6A6A6A6A6A6A6A6" as const;
const BLOCK_SIZE = 8 as const;

type KeyWrapOptions = {
  contentEncryptionKey: Buffer;
  keyEncryptionKey: Buffer;
  kryptos: IKryptos;
};

type KeyUnwrapOptions = {
  keyEncryptionKey: Buffer;
  kryptos: IKryptos;
  wrappedKey: Buffer;
};

export const _aesKeyWrap = ({
  contentEncryptionKey,
  keyEncryptionKey,
  kryptos,
}: KeyWrapOptions): Buffer => {
  const algorithm = _calculateKeywrapEncryption(kryptos);

  const n = contentEncryptionKey.length / BLOCK_SIZE;
  let a = Buffer.from(AIV, "hex");
  const r = [];

  for (let i = 0; i < n; i++) {
    r[i] = contentEncryptionKey.subarray(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE);
  }

  const cipher = createCipheriv(algorithm, keyEncryptionKey, null);
  cipher.setAutoPadding(false);

  for (let j = 0; j < 6; j++) {
    for (let i = 0; i < n; i++) {
      const b = Buffer.concat([a, r[i]]);
      const encrypted = cipher.update(b);
      a = encrypted.subarray(0, BLOCK_SIZE);
      const t = n * j + i + 1;
      const tBuffer = Buffer.alloc(BLOCK_SIZE);
      tBuffer.writeUIntBE(t, 4, 4);
      for (let k = 0; k < BLOCK_SIZE; k++) {
        a[k] ^= tBuffer[k];
      }
      r[i] = encrypted.subarray(BLOCK_SIZE);
    }
  }

  return Buffer.concat([a, ...r]);
};

export const _aesKeyUnwrap = ({
  keyEncryptionKey,
  kryptos,
  wrappedKey,
}: KeyUnwrapOptions): Buffer => {
  const encryption = _calculateKeywrapEncryption(kryptos);

  const n = wrappedKey.length / BLOCK_SIZE - 1;
  let a = wrappedKey.subarray(0, BLOCK_SIZE);
  const r = [];

  for (let i = 0; i < n; i++) {
    r[i] = wrappedKey.subarray((i + 1) * BLOCK_SIZE, (i + 2) * BLOCK_SIZE);
  }

  const decipher = createDecipheriv(encryption, keyEncryptionKey, null);
  decipher.setAutoPadding(false);

  for (let j = 5; j >= 0; j--) {
    for (let i = n - 1; i >= 0; i--) {
      const t = n * j + i + 1;
      const tBuffer = Buffer.alloc(BLOCK_SIZE);
      tBuffer.writeUIntBE(t, 4, 4);
      const aXorT = Buffer.alloc(BLOCK_SIZE);
      for (let k = 0; k < BLOCK_SIZE; k++) {
        aXorT[k] = a[k] ^ tBuffer[k];
      }
      const b = Buffer.concat([aXorT, r[i]]);
      const decrypted = decipher.update(b);
      a = decrypted.subarray(0, BLOCK_SIZE);
      r[i] = decrypted.subarray(BLOCK_SIZE);
    }
  }

  if (!a.equals(Buffer.from(AIV, "hex"))) {
    throw new Error("Integrity check failed");
  }

  return Buffer.concat(r);
};
