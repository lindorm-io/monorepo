import type { IAmphora } from "@lindorm/amphora";
import { Context } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import type { Aegis } from "../classes/Aegis.js";
import type { TokenType } from "../constants/token-type.js";
import type {
  DecryptedToken,
  EncryptedToken,
  ParsedToken,
  ProfileMintOptions,
  ProfileVerifyOptions,
  SignedToken,
  VerifiedToken,
  VerifyAssert,
} from "../types/index.js";

@Context()
export class AegisContext {
  aegis!: Aegis;
  amphora!: IAmphora;

  /** The caller's statements — the claims to sign, the content to mint, or the data to encrypt. */
  claims: Dict = {};
  /** The claims in the wire vocabulary, for a raw kit or a third party to sign verbatim. */
  wireClaims: Dict = {};
  /** The bare type prefix a raw kit re-wraps as the wire's own media type. */
  typPrefix?: string;
  /** The caller's text, when what is sealed is a string rather than an object. */
  text?: string;
  tokenType?: TokenType;
  /** An explicit type header, stated over the token type. */
  typ?: string;
  /** What a mint is asked beyond its content and its wire. */
  mintOptions: ProfileMintOptions = {};
  /** What a verify is asked beyond the profile, the token and the audience. */
  verifyOptions: Omit<ProfileVerifyOptions, "audience"> = {};
  /** What the verifier asserts about the claims — the matcher bag the signed and the static door share. */
  assert?: VerifyAssert;
  /** The boolean door's answer, when the claims were checked without a signature. */
  matched?: boolean;

  /** The last act's artifact, whichever verb produced it. */
  token?: string;
  signed?: SignedToken;
  encrypted?: EncryptedToken;
  verified?: VerifiedToken;
  decrypted?: DecryptedToken;
  parsed?: ParsedToken;

  /** What the last act threw, when it threw. */
  refusal?: unknown;

  dispose(): void {
    MockDate.reset();
  }
}
