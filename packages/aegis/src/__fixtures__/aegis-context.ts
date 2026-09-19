import type { IAmphora } from "@lindorm/amphora";
import { Context } from "@lindorm/gherkin";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import type { Aegis } from "../classes/Aegis.js";
import type { TokenType } from "../constants/token-type.js";
import type {
  CoseHeaderBuckets,
  DecryptedToken,
  DomainProtectedHeader,
  EncryptedToken,
  JoseHeaderBuckets,
  ParsedToken,
  ProfileMintOptions,
  ProfileVerifyOptions,
  SignedToken,
  VerifiedToken,
  VerifyAssert,
} from "../types/index.js";
import type { DpopProofStatement } from "./dpop-presenter.js";
import type { ForeignHeaders } from "./third-party-producer.js";

/**
 * What a raw door reports: the header buckets as the kit spells them, and the
 * payload it verified — wire claims at a claims door, the reconstructed content
 * at an opaque one.
 */
export type RawDoorResult = (JoseHeaderBuckets | CoseHeaderBuckets) & {
  payload?: unknown;
};

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
  /** The caller's REGISTERED header bag for a raw kit door, in the wire vocabulary. */
  wireHeader?: Dict;
  /**
   * The caller's UNREGISTERED header bags for a raw kit door: `header` is the
   * bucket every wire has — JOSE's one header, COSE's protected bucket — and
   * `unprotected` is COSE's second.
   */
  customHeader: { header?: Dict; unprotected?: Dict } = {};
  /** The caller's protected header statements for a domain door, in the domain vocabulary. */
  domainHeader?: DomainProtectedHeader;
  /** What a third party writes beside the `alg` and `kid` it derives from its key. */
  foreignHeaders: ForeignHeaders = {};
  /** What a mint is asked beyond its content and its wire. */
  mintOptions: ProfileMintOptions = {};
  /** What a verify is asked beyond the profile, the token and the audience. */
  verifyOptions: Omit<ProfileVerifyOptions, "audience"> = {};
  /** What the presenter signs into a proof of possession, before the token it commits to exists. */
  proofStatement?: DpopProofStatement;
  /** What the presenter writes in the proof's header beside the parameters it derives. */
  proofHeader?: Dict;
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
  /** A raw door's result: the header buckets and the payload as the kit reports them. */
  rawVerified?: RawDoorResult;

  /** What the last act threw, when it threw. */
  refusal?: unknown;

  dispose(): void {
    MockDate.reset();
  }
}
