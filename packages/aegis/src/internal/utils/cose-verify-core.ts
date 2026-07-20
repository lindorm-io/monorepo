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

  if (deps.coseKit.isEncrypted(bytes)) {
    const encKryptos = await deps.resolveDecryptKey(
      deps.coseKit.decodeEncryptedKid(bytes),
      undefined,
    );
    bytes = deps.coseKit.decrypt(encKryptos, bytes);
  }

  const decoded = deps.coseKit.decode(bytes);
  const kryptos = await deps.resolveVerifyKey(decoded.kid, undefined);
  const { claims, wire, typ } = deps.coseKit.verify(kryptos, bytes);

  return { claims, wire, decoded, typ };
};
