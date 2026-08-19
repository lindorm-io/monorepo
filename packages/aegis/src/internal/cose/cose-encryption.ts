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
 * The COSE_Encrypt0 operations the dropped `CoseKit` façade owned — the COSE
 * analogue of `JweKit`, now standalone functions the Aegis COSE path and the
 * `mintCoseToken` sign-then-encrypt composition call directly.
 */

/**
 * Seal `content` in a bare COSE_Encrypt0. Two callers, one body: the
 * sign-then-encrypt composition hands it already-secured CWT bytes (with an
 * explicit `application/cwt` cty), and the domain encrypt path hands it the
 * caller's own value — `CweKit` serialises whatever it is and stamps the cty
 * that describes it. `proprietary` threads the interop encryption gate (a
 * private-use AES-CBC-HMAC needs it; default strict).
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
   * The kit's OWN encrypt options, forwarded STRUCTURALLY — the caller's
   * protected/unprotected header bags, the `tokenType` PREFIX, the interop gate.
   * A NESTED signed token's `application/cwt` cty rides `header.cty`, stamped by
   * the sign-then-encrypt composition; opaque data carries none and floors to the
   * inferred `application/octet-stream`.
   */
  options: CweEncryptOptions;
  /** Deployment fallback for a key that declares no `encryption`. */
  defaultEncryption?: KryptosEncryption;
}): Buffer =>
  // `CweKit.encrypt` returns the BARE encoded COSE_Encrypt0 bytes.
  new CweKit({ certBindingMode, kryptos, logger, defaultEncryption }).encrypt(
    content,
    options,
  );

/**
 * Decrypt a COSE_Encrypt0 to its plaintext, RECONSTRUCTED by the cty its own
 * protected header declares. An `application/cwt` plaintext reconstructs to the
 * inner secured bytes; a caller's own payload comes back as the Dict, string or
 * `Buffer` it was sealed as, which is why the COSE wire's `decrypt` widens `T`
 * to `TokenContent`.
 */
export const decryptCose = <T extends TokenContent = Buffer>({
  certBindingMode,
  kryptos,
  logger,
  token,
}: {
  certBindingMode?: CertificateBindingMode;
  kryptos: IKryptos;
  logger: ILogger;
  token: Buffer;
}): T => {
  // R2: `CweKit.decrypt` takes the ENCODED bytes and strips the outer CWT tag (61)
  // itself; hand it the token verbatim.
  const { payload } = new CweKit({ certBindingMode, kryptos, logger }).decrypt<T>(token);
  return payload;
};

/** True if the COSE token is an encrypted CWT (COSE_Encrypt0, tag 16). */
export const isEncryptedCose = (token: Buffer): boolean =>
  coseStructure(decodeCbor(token))?.tag === COSE_TAG.encrypt0;

/** Read the COSE_Encrypt0 kid (unprotected, label 4) WITHOUT decrypting. */
export const decodeEncryptedCoseKid = (token: Buffer): string | undefined => {
  const cose = coseStructure(decodeCbor(token));
  const unprotected = Array.isArray(cose?.contents)
    ? (cose.contents[1] as Map<number, unknown>)
    : undefined;
  const kid = unprotected?.get(coseByJose("kid"));
  return kid instanceof Uint8Array ? Buffer.from(kid).toString("utf8") : undefined;
};
