import { randomBytes } from "crypto";
import { KryptosAlgorithm, KryptosEncryption } from "../../../types";
import { getOctSize } from "./get-size";

type Options = {
  algorithm: KryptosAlgorithm;
  encryption?: KryptosEncryption | null;
};

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const generateOctKey = (options: Options): Result => {
  const size = getOctSize(options);

  return {
    privateKey: randomBytes(size),
    publicKey: Buffer.alloc(0),
  };
};
