import { createHmac } from "crypto";
import { ShaAlgorithm } from "../../../enums";
import { AesError } from "../../../errors";

type Options = {
  hash?: ShaAlgorithm;
  initialKeyringMaterial: Buffer;
  length: number;
};

const getHashLength = (hash: ShaAlgorithm): number => {
  switch (hash) {
    case ShaAlgorithm.SHA256:
      return 32;

    case ShaAlgorithm.SHA384:
      return 48;

    case ShaAlgorithm.SHA512:
      return 64;

    default:
      throw new AesError("Unexpected hash algorithm", { debug: { hash } });
  }
};

export const createKeyDerivation = ({
  hash = ShaAlgorithm.SHA256,
  initialKeyringMaterial,
  length,
}: Options): Buffer => {
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
