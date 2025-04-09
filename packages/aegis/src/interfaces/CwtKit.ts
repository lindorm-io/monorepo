import { Dict } from "@lindorm/types";
import {
  ParsedCwt,
  SignCwtContent,
  SignCwtOptions,
  SignedCwt,
  VerifyCwtOptions,
} from "../types";

export interface ICwtKit {
  sign<T extends Dict = Dict>(
    content: SignCwtContent<T>,
    options?: SignCwtOptions,
  ): SignedCwt;
  verify<T extends Dict = Dict>(token: string, verify?: VerifyCwtOptions): ParsedCwt<T>;
}
