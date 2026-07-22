import type {
  DecodedOpaqueToken,
  JwsContent,
  ParsedJws,
  SignJwsOptions,
  SignedJws,
} from "../../types/index.js";

export interface IJwsKit {
  sign<T extends JwsContent>(data: T, options?: SignJwsOptions): SignedJws;
  verify<T extends JwsContent>(token: string): ParsedJws<T>;
  /**
   * WIRE-only read (no signature check): the unified wire header + the opaque
   * payload bytes. Uniform with `CwsKit` decode.
   */
  decode(token: string): DecodedOpaqueToken;
}
