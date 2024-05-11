import { createHmac } from "crypto";
import { AesError } from "../../../errors";
import { Encryption, ShaHash } from "../../../types";
import { _calculateSecretLength } from "./calculate-secret-length";

type Options = {
  encryption: Encryption;
  hash?: ShaHash;
  initialKeyringMaterial: Buffer;
};

const getHashLength = (hash: ShaHash): number => {
  switch (hash) {
    case "sha256":
      return 32;

    case "sha384":
      return 48;

    case "sha512":
      return 64;

    default:
      throw new AesError("Unexpected hash algorithm", { debug: { hash } });
  }
};

export const _createKeyDerivation = ({
  encryption,
  hash = "sha256",
  initialKeyringMaterial,
}: Options): Buffer => {
  const length = _calculateSecretLength(encryption);
  const hashLength = getHashLength(hash);

  // Step 1: Extract
  const prk = createHmac(hash, Buffer.alloc(hashLength, 0)).update(initialKeyringMaterial).digest();

  // Step 2: Expand
  const blocks = [];
  let block = Buffer.alloc(0);

  for (let i = 1; blocks.length * hashLength < length; i++) {
    block = createHmac(hash, prk)
      .update(block)
      .update(Buffer.from([i]))
      .digest();

    blocks.push(block);
  }

  // Concatenate the blocks and slice to the desired length
  return Buffer.concat(blocks).subarray(0, length);
};
