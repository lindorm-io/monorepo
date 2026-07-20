import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { CweKit } from "../../classes/CweKit.js";
import { coseByJose } from "../header/header-registry.js";
import { Tag, decodeCbor, encodeCbor } from "./cbor.js";
import { COSE_TAG } from "./structures.js";

/**
 * The COSE_Encrypt0 operations the dropped `CoseKit` façade owned — the COSE
 * analogue of `JweKit`, now standalone functions the Aegis COSE path and the
 * `mintCoseToken` sign-then-encrypt composition call directly.
 */

// Strip an optional outer CWT tag (61) to reach the COSE structure.
const innerCose = (value: unknown): Tag | undefined => {
  const cose =
    value instanceof Tag && value.tag === COSE_TAG.cwt ? value.contents : value;
  return cose instanceof Tag ? cose : undefined;
};

/**
 * Wrap already-secured CWT bytes in a bare COSE_Encrypt0 (sign-then-encrypt) —
 * the inner CWT bytes are the plaintext. `proprietary` threads the interop
 * encryption gate (a private-use AES-CBC-HMAC needs it; default strict).
 */
export const encryptCose = ({
  kryptos,
  logger,
  inner,
  typ,
  encryption,
  proprietary,
}: {
  kryptos: IKryptos;
  logger: ILogger;
  inner: Buffer;
  typ?: string;
  encryption?: KryptosEncryption;
  proprietary?: boolean;
}): Buffer => {
  const encrypt0 = new CweKit({ kryptos, logger, encryption }).encrypt(inner, {
    typ,
    proprietary,
  });

  return Buffer.from(encodeCbor(encrypt0));
};

/** Decrypt a COSE_Encrypt0 to its inner (secured) CWT bytes. */
export const decryptCose = ({
  kryptos,
  logger,
  token,
}: {
  kryptos: IKryptos;
  logger: ILogger;
  token: Buffer;
}): Buffer => {
  const cose = innerCose(decodeCbor(token));
  const { payload } = new CweKit({ kryptos, logger }).decrypt(cose);
  return payload;
};

/** True if the COSE token is an encrypted CWT (COSE_Encrypt0, tag 16). */
export const isEncryptedCose = (token: Buffer): boolean =>
  innerCose(decodeCbor(token))?.tag === COSE_TAG.encrypt0;

/** Read the COSE_Encrypt0 kid (unprotected, label 4) WITHOUT decrypting. */
export const decodeEncryptedCoseKid = (token: Buffer): string | undefined => {
  const cose = innerCose(decodeCbor(token));
  const unprotected = Array.isArray(cose?.contents)
    ? (cose.contents[1] as Map<number, unknown>)
    : undefined;
  const kid = unprotected?.get(coseByJose("kid"));
  return kid instanceof Uint8Array ? Buffer.from(kid).toString("utf8") : undefined;
};
