import type { IAmphora } from "@lindorm/amphora";
import { Context } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import type { Aegis } from "../classes/Aegis.js";
import type { TokenType } from "../constants/token-type.js";
import type {
  DecryptedToken,
  EncryptedToken,
  ProfileMintOptions,
  SignedToken,
  VerifiedToken,
} from "../types/index.js";

@Context()
export class AegisContext {
  aegis!: Aegis;
  amphora!: IAmphora;

  /** The caller's statements — the claims to sign, the content to mint, or the data to encrypt. */
  claims: Dict = {};
  /** The caller's text, when what is sealed is a string rather than an object. */
  text?: string;
  tokenType?: TokenType;
  /** An explicit type header, stated over the token type. */
  typ?: string;
  /** What a mint is asked beyond its content and its wire. */
  mintOptions: ProfileMintOptions = {};

  /** The last act's artifact, whichever verb produced it. */
  token?: string;
  signed?: SignedToken;
  encrypted?: EncryptedToken;
  verified?: VerifiedToken;
  decrypted?: DecryptedToken;

  /** What the last act threw, when it threw. */
  refusal?: unknown;

  dispose(): void {
    MockDate.reset();
  }
}
