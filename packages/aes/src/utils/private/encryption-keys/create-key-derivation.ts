import { ShaAlgorithm } from "@lindorm/types";
import { createHmac, randomBytes } from "crypto";
import { AesError } from "../../../errors";
import { AesEncryption } from "../../../types";
import { _calculateEncryptionKeyLength } from "./calculate-encryption-key-length";

type Options = {
  encryption: AesEncryption;
  hash?: ShaAlgorithm;
  initialKeyMaterial: Buffer;
  salt?: Buffer;
};

type Result = {
  encryptionKey: Buffer;
  salt: Buffer;
};

const getHashLength = (hash: ShaAlgorithm): number => {
  switch (hash) {
    case "SHA256":
      return 32;

    case "SHA384":
      return 48;

    case "SHA512":
      return 64;

    default:
      throw new AesError("Unexpected hash algorithm", { debug: { hash } });
  }
};

export const _createKeyDerivation = ({
  encryption,
  hash = "SHA256",
  initialKeyMaterial,
  salt = randomBytes(16),
}: Options): Result => {
  const encryptionKeyLength = _calculateEncryptionKeyLength(encryption);
  const hashLength = getHashLength(hash);

  // Step 1: Extract
  const prk = createHmac(hash, salt).update(initialKeyMaterial).digest();

  // Step 2: Expand
  const blocks: Buffer[] = [];
  let block = Buffer.alloc(0);

  for (let i = 1; blocks.length * hashLength < encryptionKeyLength; i++) {
    block = createHmac(hash, prk)
      .update(Buffer.concat([block, Buffer.from([i])]))
      .digest();
    blocks.push(block);
  }

  const encryptionKey = Buffer.concat(blocks).subarray(0, encryptionKeyLength);

  return { encryptionKey, salt };
};
