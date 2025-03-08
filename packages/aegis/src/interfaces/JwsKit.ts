import { JwsContent, SignJwsOptions, SignedJws, VerifiedJws } from "../types";

export interface IJwsKit {
  sign<T extends JwsContent>(data: T, options?: SignJwsOptions): SignedJws;
  verify<T extends JwsContent>(jws: string): VerifiedJws<T>;
}
