import { PkceMethod } from "@lindorm/enums";

export type PkceResult = {
  challenge: string;
  verifier: string;
  method: PkceMethod;
};
