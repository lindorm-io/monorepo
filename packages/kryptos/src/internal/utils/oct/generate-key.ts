import { randomBytes } from "crypto";
import { promisify } from "util";
import { KryptosAlgorithm, KryptosEncryption } from "../../../types";
import { getOctSize } from "./get-size";

const randomBytesAsync = promisify(randomBytes);

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

export const generateOctKeyAsync = async (options: Options): Promise<Result> => {
  const size = getOctSize(options);

  return {
    privateKey: await randomBytesAsync(size),
    publicKey: Buffer.alloc(0),
  };
};
