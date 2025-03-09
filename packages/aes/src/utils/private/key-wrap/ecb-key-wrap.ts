import { createCipheriv, createDecipheriv } from "crypto";
import {
  KeyUnwrapOptions,
  KeyUnwrapResult,
  KeyWrapOptions,
  KeyWrapResult,
} from "../../../types/private";
import { calculateKeyWrapEncryption } from "../calculate";

const AIV = "A6A6A6A6A6A6A6A6" as const;
const BLOCK_SIZE = 8 as const;

export const ecbKeyWrap = ({
  contentEncryptionKey,
  keyEncryptionKey,
  kryptos,
}: KeyWrapOptions): KeyWrapResult => {
  const algorithm = calculateKeyWrapEncryption(kryptos);

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
      a = encrypted.subarray(0, BLOCK_SIZE) as Buffer<ArrayBuffer>;
      const t = n * j + i + 1;
      const tBuffer = Buffer.alloc(BLOCK_SIZE);
      tBuffer.writeUIntBE(t, 4, 4);
      for (let k = 0; k < BLOCK_SIZE; k++) {
        a[k] ^= tBuffer[k];
      }
      r[i] = encrypted.subarray(BLOCK_SIZE);
    }
  }

  return { publicEncryptionKey: Buffer.concat([a, ...r]) };
};

export const ecbKeyUnwrap = ({
  keyEncryptionKey,
  kryptos,
  publicEncryptionKey,
}: KeyUnwrapOptions): KeyUnwrapResult => {
  const encryption = calculateKeyWrapEncryption(kryptos);

  const n = publicEncryptionKey.length / BLOCK_SIZE - 1;
  let a = publicEncryptionKey.subarray(0, BLOCK_SIZE);
  const r = [];

  for (let i = 0; i < n; i++) {
    r[i] = publicEncryptionKey.subarray((i + 1) * BLOCK_SIZE, (i + 2) * BLOCK_SIZE);
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

  return { contentEncryptionKey: Buffer.concat(r) };
};
