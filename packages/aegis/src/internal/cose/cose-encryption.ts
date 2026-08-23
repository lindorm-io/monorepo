import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { CweKit } from "../../classes/CweKit.js";
import type {
  CertificateBindingMode,
  CweEncryptOptions,
  TokenContent,
} from "../../types/index.js";
import { coseByJose } from "../header/header-registry.js";
import { decodeCbor } from "./cbor.js";
import { COSE_TAG } from "./structures.js";
import { coseStructure } from "./unwrap-cose.js";

/**
 * The COSE_Encrypt0 operations — the COSE analogue of `JweKit`, as standalone
 * functions. `COSE_TOKEN_WIRE.encryptContent`
 * (`internal/wire/cose-token-wire.ts`) is the sign-then-encrypt caller.
 */

/**
 * Seal `content` in a bare COSE_Encrypt0. Two callers, one body: sign-then-encrypt
 * hands it already-secured CWT bytes with an explicit `application/cwt` cty, and
 * the domain encrypt path hands it the caller's own value for `CweKit` to
 * serialise and stamp. `proprietary` threads the interop encryption gate.
 */
export const encryptCose = ({
  certBindingMode,
  kryptos,
  logger,
  content,
  options,
  defaultEncryption,
}: {
  /** The deployment cert-binding mode, for the DECRYPT twin's read-side check. */
  certBindingMode?: CertificateBindingMode;
  kryptos: IKryptos;
  logger: ILogger;
  content: TokenContent;
  /**
   * The kit's OWN encrypt options, forwarded STRUCTURALLY. A nested signed token's
   * `application/cwt` cty rides `header.cty`, stamped by sign-then-encrypt; opaque
   * data carries none and floors to the inferred `application/octet-stream`.
   */
  options: CweEncryptOptions;
  /**
   * Deployment fallback for a key that declares no `encryption`.
   *
   * ⛔ REQUIRED-BUT-UNDEFINED, never optional, matching `AegisDeps`: with `?:` a
   * caller that omits it compiles clean and the read kit resolves a DIFFERENT
   * floor from the write kit, which is the shape of the defect this parameter was
   * threaded to close.
   */
  defaultEncryption: KryptosEncryption | undefined;
}): Buffer =>
  new CweKit({ certBindingMode, kryptos, logger, defaultEncryption }).encrypt(
    content,
    options,
  );

/**
 * Decrypt a COSE_Encrypt0 to its plaintext, RECONSTRUCTED by the cty its own
 * protected header declares — which is why the COSE wire's `decrypt` widens `T`
 * to `TokenContent`.
 */
export const decryptCose = <T extends TokenContent = Buffer>({
  certBindingMode,
  crit,
  defaultEncryption,
  kryptos,
  logger,
  token,
}: {
  certBindingMode?: CertificateBindingMode;
  /** The caller's `crit` declaration, handed to the kit's crit gate. */
  crit?: Array<string>;
  /**
   * The SAME deployment fallback {@link encryptCose} resolves from, and
   * required-but-undefined for the same reason it is there.
   */
  defaultEncryption: KryptosEncryption | undefined;
  kryptos: IKryptos;
  logger: ILogger;
  token: Buffer;
}): T => {
  // `CweKit.decrypt` strips the outer CWT tag itself; hand it the token verbatim.
  const { payload } = new CweKit({
    certBindingMode,
    defaultEncryption,
    kryptos,
    logger,
  }).decrypt<T>(token, { crit });
  return payload;
};

/** True if the COSE token is an encrypted CWT — a COSE_Encrypt0. */
export const isEncryptedCose = (token: Buffer): boolean =>
  coseStructure(decodeCbor(token))?.tag === COSE_TAG.encrypt0;

/** Read the COSE_Encrypt0 kid off the unprotected bucket WITHOUT decrypting. */
export const decodeEncryptedCoseKid = (token: Buffer): string | undefined => {
  const cose = coseStructure(decodeCbor(token));
  // ⚠ The slot is TYPE-CHECKED, not cast. This runs BEFORE the recipient key is
  // resolved — `internal/wire/cose-token-wire.ts` and
  // `internal/utils/raw-decrypt-cwe.ts` call it to CHOOSE that key — so the bucket
  // is a stranger's bytes. A producer may write anything, and `preferMap: false`
  // hands a wholly text-keyed map back as a plain object, so a cast lets `.get`
  // throw a raw `TypeError` out of an unauthenticated read. RFC 9052 §3.
  const unprotected = Array.isArray(cose?.contents) ? cose.contents[1] : undefined;
  // A bucket this reader cannot index states no kid — the same answer a conformant
  // bucket without one gives. The malformedness verdict belongs to
  // `CweKit.decrypt`, which reads the whole structure.
  const kid = unprotected instanceof Map ? unprotected.get(coseByJose("kid")) : undefined;
  return kid instanceof Uint8Array ? Buffer.from(kid).toString("utf8") : undefined;
};
