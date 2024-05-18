import { randomBytes } from "crypto";
import { OctGenerate } from "../../../types";
import { _getOctSize } from "./get-size";

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const _generateOctKey = (options: OctGenerate): Result => {
  const size = _getOctSize(options);

  return {
    privateKey: randomBytes(size),
    publicKey: Buffer.alloc(0),
  };
};
