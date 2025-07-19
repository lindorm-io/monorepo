import { PkceMethod } from "@lindorm/types";

export type PkceResult = {
  challenge: string;
  verifier: string;
  method: PkceMethod;
};
