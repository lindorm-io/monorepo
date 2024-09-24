import { PkceMethod } from "@lindorm/enums";

export type Pkce = {
  challenge: string;
  verifier: string;
  method: PkceMethod;
};
