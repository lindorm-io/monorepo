import { ShaAlgorithm } from "@lindorm/types";
import { createHmac } from "crypto";
import { AesError } from "../../../errors";
import { AesEncryption } from "../../../types";
import { _calculateSecretLength } from "./calculate-secret-length";

type Options = {
  encryption: AesEncryption;
  hash?: ShaAlgorithm;
  initialKeyringMaterial: Buffer;
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
