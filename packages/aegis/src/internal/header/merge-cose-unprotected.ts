import type { CoseLabel } from "../cose/cose-label.js";
import { coseWireKey } from "./header-registry.js";

/**
 * Build a COSE unprotected header map: the IV (label 5) when the structure has
 * one, `kid` (label 4), then the caller's entries, which are written last and so
 * win.
 *
 * ⚠ A SEPARATE pass from `mergeCoseProtected` because of a DATA DEPENDENCY, not
 * a preference. A COSE_Encrypt0 must finalise its protected header BEFORE the
 * AEAD runs — that header IS the AAD — and the IV only exists after, so the two
 * buckets cannot be written together. The signed kits simply have no IV.
 */
export const mergeCoseUnprotected = ({
  kid,
  iv,
  entries,
  proprietary,
}: {
  kid: string;
  /** The AEAD initialisation vector; absent for the signed structures. */
  iv?: Buffer;
  entries: Map<CoseLabel, unknown>;
  /**
   * The caller's INTEROP MODE — see `mergeCoseProtected`. `kid` (4) and `iv` (5)
   * are registered, so it changes nothing here today; it is threaded so ONE
   * resolver spells every parameter this bucket carries.
   */
  proprietary: boolean | undefined;
}): Map<CoseLabel, unknown> => {
  const map = new Map<CoseLabel, unknown>();

  if (iv) map.set(coseWireKey("iv", proprietary), iv);

  map.set(coseWireKey("kid", proprietary), Buffer.from(kid, "utf8"));

  for (const [label, value] of entries) map.set(label, value);

  return map;
};
