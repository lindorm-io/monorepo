import type { JwsContent, ParsedJws, SignJwsOptions, SignedJws } from "../types/index.js";

export interface IJwsKit {
  sign<T extends JwsContent>(data: T, options?: SignJwsOptions): SignedJws;
  verify<T extends JwsContent>(token: string): ParsedJws<T>;
}
