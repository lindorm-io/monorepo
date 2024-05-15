import { randomBytes } from "crypto";
import { OctGenerate } from "../../../types";

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const _generateOctKey = async (options: OctGenerate): Promise<Result> => ({
  privateKey: randomBytes(options.size),
  publicKey: Buffer.alloc(0),
});
