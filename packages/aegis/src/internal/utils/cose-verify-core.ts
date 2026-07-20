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
  deps,
}: {
  input: Buffer;
  deps: AegisDeps;
}) => {
  let bytes = input;

  if (isEncryptedCose(bytes)) {
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
  });

  return { claims, wire, decoded, typ };
};
