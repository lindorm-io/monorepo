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
import { COSE_TAG, readProtectedHeader } from "./structures.js";
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

/** Read the COSE_Encrypt0 kid off its header buckets WITHOUT decrypting. */
export const decodeEncryptedCoseKid = (token: Buffer): string | undefined => {
  const cose = coseStructure(decodeCbor(token));
  const contents: Array<unknown> | undefined = Array.isArray(cose?.contents)
    ? cose.contents
    : undefined;
  const kidLabel = coseByJose("kid");
  const protectedMap = readProtectedHeader(contents?.[0]);
  const unprotected = contents?.[1];

  // ⚠ THE PROTECTED BUCKET FIRST, AND ON `has` — the unprotected one answers only
  // where the attribute is NOT FOUND in the protected one (RFC 9052 §3), which is
  // presence and not usability, so `Map.get` answering `null` for the CBOR null or
  // `undefined` for the CBOR undefined is a kid the producer STATED. Deciding on
  // the value instead would let the rewritable bucket choose the recipient key.
  // pinned: cose-sign-encrypt.test.ts
  //
  // ⚠ Both slots are TYPE-CHECKED, not cast, and the protected one through the
  // NEVER-THROWING `readProtectedHeader`. This runs BEFORE the recipient key is
  // resolved — `internal/wire/cose-token-wire.ts` and
  // `internal/utils/raw-decrypt-cwe.ts` call it to CHOOSE that key — so both
  // buckets are a stranger's bytes. A producer may write an integer, a text string,
  // an array or a byte string where the map belongs, and a cast lets `.get` throw a
  // raw `TypeError` out of an unauthenticated read.
  //
  // A slot this reader cannot index holds no kid — the same answer a conformant
  // bucket without one gives. The malformedness verdict belongs to
  // `CweKit.decrypt`, which reads the whole structure.
  const unprotectedKid =
    unprotected instanceof Map ? unprotected.get(kidLabel) : undefined;

  const kid = protectedMap?.has(kidLabel) ? protectedMap.get(kidLabel) : unprotectedKid;

  return kid instanceof Uint8Array ? Buffer.from(kid).toString("utf8") : undefined;
};
