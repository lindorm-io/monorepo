import type {
  IKryptos,
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosSigAlgorithm,
} from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type {
  AegisDecryptKey,
  AegisEncKey,
  AegisVerifyKey,
  CertificateBindingMode,
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
 * Phase-11 shape: the two kit façades are GONE — the verb utils build the wire
 * kits directly from the resolved key + this bundle's JOSE/COSE config
 * (`certBindingMode`/`clockTolerance`/`encryption`/`logger`). The key resolvers
 * close over `amphora` and stay on `Aegis`; the raw-namespace operations
 * (`verifyJwt`/`verifyJws`/`decryptJwe`/`signJws`/`signRawCose`) are still
 * threaded through here because they live on `Aegis` (the raw-namespace
 * extraction is Phase 12).
 */
export type AegisDeps = {
  issuer: string | null;
  certBindingMode: CertificateBindingMode;
  clockTolerance: number;
  encryption: KryptosEncryption;
  logger: ILogger;

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
