import { CwsContent, ParsedCws, SignCwsOptions, SignedCws } from "../types";

export interface ICwsKit {
  sign<T extends CwsContent>(data: T, options?: SignCwsOptions): SignedCws;
  verify<T extends CwsContent>(token: string): ParsedCws<T>;
}
