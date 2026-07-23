import { CwtKit } from "../../classes/CwtKit.js";
import {
  decodeEncryptedCoseKid,
  decryptCose,
  isEncryptedCose,
} from "../cose/cose-encryption.js";
import { verifyCose } from "../cose/verify-cose.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * The integrity core shared by the profile (`verifyProfileToken` → `verifyCoseToken`)
 * and profile-less (`verifyToken`) COSE paths: decrypt a COSE_Encrypt0 if present,
 * then resolve the signing/MAC key by kid (kid-only, never a header-embedded key)
 * and verify. The profile floor — if any — is applied by the caller.
 */
export const coseVerifyCore = async ({
  input,
  currentDate,
  maxTokenAge,
  deps,
}: {
  input: Buffer;
  /** Override "now" for the in-kit temporal range check (R10). Per-call only. */
  currentDate?: Date;
  /** Reject a token whose `iat` is older than this many seconds (R10). Per-call only. */
  maxTokenAge?: number;
  deps: AegisDeps;
}) => {
  let bytes = input;

  // Whether the outer COSE was a COSE_Encrypt0 (cwe). Drives the read-side
  // sensitive-claim gate: sensitive claims (OIDC Core §13.3) surface only from
  // an encrypted CWT, and are suppressed on an unencrypted one.
  const encrypted = isEncryptedCose(bytes);

  if (encrypted) {
    const encKryptos = await deps.resolveDecryptKey(
      decodeEncryptedCoseKid(bytes),
      undefined,
    );
    bytes = decryptCose({ kryptos: encKryptos, logger: deps.logger, token: bytes });
  }

  const decoded = CwtKit.decode(bytes);
  const kryptos = await deps.resolveVerifyKey(decoded.kid, undefined);
  const { claims, wire, typ } = verifyCose({
    kryptos,
    logger: deps.logger,
    token: bytes,
    clockTolerance: deps.clockTolerance,
    currentDate,
    maxTokenAge,
  });

  return { claims, wire, decoded, typ, encrypted };
};
