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
  AegisSignKey,
  AegisVerifyKey,
  CertificateBindingMode,
  TokenProfile,
} from "../../types/index.js";

/**
 * The per-call arguments of the verify-key resolver. An OPTIONS OBJECT rather
 * than positionals: it carries four independent, all-optional inputs, and the
 * issuer scope has to be threadable from paths that have no algorithm to pass
 * (COSE) without every caller counting `undefined`s.
 */
export type ResolveVerifyKeyOptions = {
  /** The `kid` the artifact names. */
  id: string | undefined;
  /** The `alg` the artifact declares — recorded, never used to select. */
  algorithm: KryptosSigAlgorithm | undefined;
  /**
   * The issuer to NARROW the `kid` lookup to — a kid is unique only per issuer.
   * The verifier's expected issuer when it declared one, else the artifact's own
   * UNVERIFIED `iss`. Narrowing only; no fallback. See `ResolveKeyOptions.issuer`.
   */
  issuer?: string;
  /** Per-call key policy / an outright-supplied key. */
  verify?: AegisVerifyKey;
};

/**
 * The state + collaborators the internal utility functions read off `Aegis`.
 * `Aegis` assembles this bundle from its own state once and passes it to each
 * util, so every pipeline body — the verb surface AND the raw namespaces — lives
 * in `internal/utils/*` and the class keeps only state + interface + delegation.
 *
 * The two kit façades are GONE (Phase 11): the utils build the wire kits directly
 * from the resolved key + this bundle's JOSE/COSE config
 * (`certBindingMode`/`clockTolerance`/`encryption`/`dpopMaxSkew`/`logger`). The
 * key resolvers close over `amphora` and stay on `Aegis`, reaching the utils
 * through here. Since Phase 12 the raw-namespace operations are standalone utils
 * (`rawVerifyJwt`/`rawSignJws`/…) too, so they are no longer threaded through
 * this bundle — the verb utils call them directly.
 */
export type AegisDeps = {
  issuer: string | null;
  certBindingMode: CertificateBindingMode;
  /** Resolved deployment default for emitting the SHA-1 cert thumbprint (`x5t`). */
  certificateThumbprintSha1: boolean;
  clockTolerance: number;
  dpopMaxSkew: number;
  /** Deployment fallback for a key that declares no `encryption`. */
  defaultEncryption: KryptosEncryption | undefined;
  /** This recipient's ECDH-ES identity (base64url `apv`) for read-side verification. */
  partyRecipient: string | undefined;
  logger: ILogger;

  resolveSignKey: (
    options: { key?: AegisSignKey },
    profile?: TokenProfile,
  ) => Promise<IKryptos>;
  resolveVerifyKey: (options: ResolveVerifyKeyOptions) => Promise<IKryptos>;
  resolveEncryptKey: (encrypt?: AegisEncKey) => Promise<IKryptos>;
  // NOT issuer-scoped, and it cannot be: an encrypted artifact's claims are
  // behind the very key this resolves, so there is no `iss` to scope by. See the
  // unscoped-paths note in `resolve-key.ts`.
  resolveDecryptKey: (
    id: string | undefined,
    algorithm: KryptosEncAlgorithm | undefined,
    decrypt?: AegisDecryptKey,
  ) => Promise<IKryptos>;
  resolveEncKey: (
    encrypt: AegisEncKey | undefined,
    required: boolean,
  ) => Promise<IKryptos | undefined>;
};
