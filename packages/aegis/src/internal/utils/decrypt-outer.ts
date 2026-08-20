import { assertWireInput } from "../wire/assert-wire-input.js";
import type { DecryptInput, TokenWire } from "../wire/token-wire.js";
import type { AegisDeps } from "./aegis-deps.js";

/**
 * Peel an encrypting outer down to the nested token it was sealed over — the
 * read twin of `encryptOuter`, and the projection `verify` needs: the plaintext
 * as a token STRING it can re-read, plus the outer's own declaration of what that
 * plaintext is.
 *
 * NOT a wire operation — a projection of one. `wire.decrypt` reports the whole
 * read; this narrows it with the wire's own `encodeToken`, so a plaintext that
 * cannot be a token of this wire (a reconstructed claims object, an opaque value
 * with no token serialisation) comes back `undefined` and verify refuses it for
 * carrying no signature.
 */
export const decryptOuter = async (
  wire: TokenWire,
  token: string,
  deps: AegisDeps,
  /**
   * The verify caller's own `crit` declaration. It DOES flow, unlike the key
   * policy beside it: the crit gate runs on this OUTER envelope inside the kit's
   * decrypt, so a nested token whose outer carries a declared custom critical
   * parameter is unverifiable without it.
   */
  crit: Array<string> | undefined,
): Promise<{ inner: string | undefined; contentType: string | undefined }> => {
  // No per-call key policy: this peel is one STEP of reading a signed token, not
  // a caller's `aegis.decrypt`, and the caller's key policy governs the signature
  // below it.
  const input: DecryptInput = { token, deps, key: undefined, crit };

  assertWireInput(wire.dispositions.decrypt, input, {
    format: wire.encryptedFormat,
    operation: "decrypt",
  });

  const read = await wire.decrypt(input);

  return {
    inner: wire.encodeToken(read.payload),
    contentType: read.header.contentType,
  };
};
