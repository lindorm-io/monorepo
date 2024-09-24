import { PkceMethod } from "@lindorm/enums";
import { Pkce } from "../types";
import { assertPkce, createPkce, verifyPkce } from "../utils/private";

export class PKCE {
  public static create(method: PkceMethod = PkceMethod.S256, length = 43): Pkce {
    return createPkce(method, length);
  }

  public static verify(
    challenge: string,
    verifier: string,
    method: PkceMethod = PkceMethod.S256,
  ): boolean {
    return verifyPkce(challenge, verifier, method);
  }

  public static assert(
    challenge: string,
    verifier: string,
    method: PkceMethod = PkceMethod.S256,
  ): void {
    return assertPkce(challenge, verifier, method);
  }
}
