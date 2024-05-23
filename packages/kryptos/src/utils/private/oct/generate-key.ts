import { randomBytes } from "crypto";
import { OctGenerate } from "../../../types";
import { getOctSize } from "./get-size";

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const generateOctKey = (options: OctGenerate): Result => {
  const size = getOctSize(options);

  return {
    privateKey: randomBytes(size),
    publicKey: Buffer.alloc(0),
  };
};
