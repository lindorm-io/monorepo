import type { PkceMethod } from "@lindorm/types";
import type { PkceResult } from "../types/index.js";
import { createBaseHash } from "./create-base-hash.js";
import { randomBaseString } from "./random-base-string.js";

export const createPkce = (method: PkceMethod, length: number): PkceResult => {
  const verifier = randomBaseString(length);
  const challenge = method === "plain" ? verifier : createBaseHash(verifier);

  return { challenge, verifier, method };
};
