import {
  CoseSignContent,
  ParsedCoseSign,
  SignCoseSignOptions,
  SignedCoseSign,
} from "../types";

export interface ICoseSignKit {
  sign<T extends CoseSignContent>(data: T, options?: SignCoseSignOptions): SignedCoseSign;
  verify<T extends CoseSignContent>(token: string): ParsedCoseSign<T>;
}
