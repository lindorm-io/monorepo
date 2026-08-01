import type { PkceMethod } from "../enums/index.js";

export type PkceResult = {
  challenge: string;
  verifier: string;
  method: PkceMethod;
};
