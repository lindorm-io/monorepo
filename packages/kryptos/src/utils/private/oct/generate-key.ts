import { randomBytes } from "crypto";
import { OctGenerate } from "../../../types";

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const _generateOctKey = (options: OctGenerate): Result => ({
  privateKey: randomBytes(options.size),
  publicKey: Buffer.alloc(0),
});
