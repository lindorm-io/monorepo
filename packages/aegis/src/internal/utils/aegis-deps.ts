import type {
  IKryptos,
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosSigAlgorithm,
} from "@lindorm/kryptos";
import type { CoseKit } from "../../classes/CoseKit.js";
import type { JoseKit } from "../../classes/JoseKit.js";
import type {
  AegisDecryptKey,
  AegisEncKey,
  AegisVerifyKey,
  DecryptedJwe,
  JweDecryptOptions,
  JwsContent,
  ParsedJws,
  ParsedJwt,
  RawSignInput,
  SignedJws,
  SignJwsOptions,
  SignJwtOptions,
  TokenProfile,
  VerifyJwsOptions,
  VerifyJwtOptions,
} from "../../types/index.js";

/**
 * The state + collaborators the verb-surface utility functions
 * (`verifyToken` / `verifyProfileToken` / `mintToken` / `signToken`) read off
 * `Aegis`. `Aegis` assembles this bundle from its own state once and passes it
 * to each util, so the pipeline bodies live in `internal/utils/*` and the class
 * keeps only state + interface + delegation.
 *
 * Phase-10 shape: the key resolvers close over `amphora` and stay on `Aegis`;
 * the two kit façades (`joseKit`/`coseKit`) and the raw-namespace operations
 * (`verifyJwt`/`verifyJws`/`decryptJwe`/`signJws`/`signRawCose`) are threaded
 * through here because they still live on `Aegis` (the façade drop is Phase 11,
 * the raw-namespace extraction is Phase 12).
 */
export type AegisDeps = {
  issuer: string | null;
  clockTolerance: number;
  encryption: KryptosEncryption;

  joseKit: JoseKit;
  coseKit: CoseKit;

  resolveSignKey: (
    options: SignJwsOptions | SignJwtOptions,
    profile?: TokenProfile,
  ) => Promise<IKryptos>;
  resolveVerifyKey: (
    id: string | undefined,
    algorithm: KryptosSigAlgorithm | undefined,
    verify?: AegisVerifyKey,
  ) => Promise<IKryptos>;
  resolveDecryptKey: (
    id: string | undefined,
    algorithm: KryptosEncAlgorithm | undefined,
    decrypt?: AegisDecryptKey,
  ) => Promise<IKryptos>;
  resolveEncKey: (
    encrypt: AegisEncKey | undefined,
    required: boolean,
  ) => Promise<IKryptos | undefined>;

  verifyJwt: (jwt: string, verify?: VerifyJwtOptions) => Promise<ParsedJwt>;
  verifyJws: (jws: string, options?: VerifyJwsOptions) => Promise<ParsedJws<any>>;
  decryptJwe: (jwe: string, options?: JweDecryptOptions) => Promise<DecryptedJwe>;
  signJws: (data: JwsContent, options?: SignJwsOptions) => Promise<SignedJws>;
  signRawCose: (input: RawSignInput) => Promise<SignedJws>;
};
