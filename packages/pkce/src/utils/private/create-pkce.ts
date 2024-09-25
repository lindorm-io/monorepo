import { PkceMethod } from "@lindorm/enums";
import { PkceResult } from "../../types";
import { createBaseHash } from "./create-base-hash";
import { randomBaseString } from "./random-base-string";

export const createPkce = (method: PkceMethod, length: number): PkceResult => {
  const verifier = randomBaseString(length);
  const challenge = method === "plain" ? verifier : createBaseHash(verifier);

  return { challenge, verifier, method };
};
