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
  encryption: KryptosEncryption;
  /** This recipient's ECDH-ES identity (base64url `apv`) for read-side verification. */
  partyRecipient: string | undefined;
  logger: ILogger;

  resolveSignKey: (
    options: { key?: AegisSignKey },
    profile?: TokenProfile,
  ) => Promise<IKryptos>;
  resolveVerifyKey: (
    id: string | undefined,
    algorithm: KryptosSigAlgorithm | undefined,
    verify?: AegisVerifyKey,
  ) => Promise<IKryptos>;
  resolveEncryptKey: (encrypt?: AegisEncKey) => Promise<IKryptos>;
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
