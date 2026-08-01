import type { PkceMethod } from "../enums/index.js";
import type { PkceResult } from "../types/index.js";
import { assertPkce, createPkce, verifyPkce } from "../internal/index.js";

export class PKCE {
  static create(method: PkceMethod = "S256", length = 43): PkceResult {
    return createPkce(method, length);
  }

  static verify(
    challenge: string,
    verifier: string,
    method: PkceMethod = "S256",
  ): boolean {
    return verifyPkce(challenge, verifier, method);
  }

  static assert(challenge: string, verifier: string, method: PkceMethod = "S256"): void {
    return assertPkce(challenge, verifier, method);
  }
}
