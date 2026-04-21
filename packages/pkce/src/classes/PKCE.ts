import type { PkceMethod } from "@lindorm/types";
import type { PkceResult } from "../types/index.js";
import { assertPkce, createPkce, verifyPkce } from "../internal/index.js";

export class PKCE {
  public static create(method: PkceMethod = "S256", length = 43): PkceResult {
    return createPkce(method, length);
  }

  public static verify(
    challenge: string,
    verifier: string,
    method: PkceMethod = "S256",
  ): boolean {
    return verifyPkce(challenge, verifier, method);
  }

  public static assert(
    challenge: string,
    verifier: string,
    method: PkceMethod = "S256",
  ): void {
    return assertPkce(challenge, verifier, method);
  }
}
