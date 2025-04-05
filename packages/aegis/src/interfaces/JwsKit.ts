import { JwsContent, ParsedJws, SignJwsOptions, SignedJws } from "../types";

export interface IJwsKit {
  sign<T extends JwsContent>(data: T, options?: SignJwsOptions): SignedJws;
  verify<T extends JwsContent>(jws: string): ParsedJws<T>;
}
