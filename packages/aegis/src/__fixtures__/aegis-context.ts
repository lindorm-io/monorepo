import type { IAmphora } from "@lindorm/amphora";
import { Context } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import type { Aegis } from "../classes/Aegis.js";
import type { TokenType } from "../constants/token-type.js";
import type { EncryptedToken, SignedToken, VerifiedToken } from "../types/index.js";

@Context()
export class AegisContext {
  aegis!: Aegis;
  amphora!: IAmphora;

  /** The caller's statements — the claims to sign, or the data to encrypt. */
  claims: Dict = {};
  tokenType?: TokenType;

  /** The last act's artifact, whichever verb produced it. */
  token?: string;
  signed?: SignedToken;
  encrypted?: EncryptedToken;
  verified?: VerifiedToken;

  /** What the last act threw, when it threw. */
  refusal?: unknown;

  dispose(): void {
    MockDate.reset();
  }
}
