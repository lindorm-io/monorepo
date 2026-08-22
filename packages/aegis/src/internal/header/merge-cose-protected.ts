import type { CoseError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import type { CoseLabel } from "../cose/cose-label.js";
import { encodeProtectedHeader } from "../cose/structures.js";
import { assertCritSatisfied } from "./assert-crit-satisfied.js";
import { coseWireKey } from "./header-registry.js";

/**
 * Build and ENCODE a COSE protected header: the parameters every write kit derives
 * — `alg` (label 1), `typ` (label 16) and `cty` (label 3) — then the caller's
 * already translated and validated entries on top.
 *
 * `cty` is OPTIONAL: a CWT/CWM payload IS a CWT Claims Set (RFC 8392 §7.2), so the
 * claims writer derives no content type and label 3 is absent unless a caller sets
 * one.
 *
 * ⚠ ORDER IS PRECEDENCE, not layout: the caller's entries are written LAST, so a
 * caller `cty` legitimately overwrites the inferred one — while `typ` is REFUSED to
 * callers by `buildCoseHeaders`. The encoded BYTES are unaffected by insertion
 * order; `encodeCbor` is deterministic and sorts the labels.
 *
 * ⚠ The unprotected bucket is a SEPARATE function (`mergeCoseUnprotected`) because
 * of a DATA DEPENDENCY: a COSE_Encrypt0 must finalise its protected header BEFORE
 * the AEAD runs — that header IS the AAD — and the IV only exists after.
 *
 * ⚠ THIS IS WHERE THE COSE PROTECTED BUCKET BECOMES COMPLETE, which is why the
 * `crit` check runs here ({@link assertCritSatisfied}) rather than in
 * `buildCoseHeaders`, which sees the caller's fragment alone. Asked on that
 * fragment, `crit: ["alg"]` refuses a message whose protected bucket does carry
 * `alg`, while the JOSE twin mints the same header.
 *
 * ⚠ DO NOT READ THE CHECK AS UNREACHABLE AND DELETE IT. `crit: ["alg"]` is now
 * refused upstream by the eligibility gate, but what this call catches is the case
 * that gate says nothing about: an ELIGIBLE member whose VALUE the bucket does not
 * carry — `crit: ["oid"]` with `oid` absent or empty. Reachable from every COSE
 * door and pinned per door in `assert-crit-satisfied.test.ts`.
 *
 * ⚠ It runs on the MAP, before the bytes: a COSE `crit`'s members are LABELS
 * (RFC 9052 §1.5, translated by `critToCoseLabels` on the way in) and the map's
 * keys are the same labels, so the two compare in one vocabulary. Rule 1b of
 * `buildCoseHeaders` has already refused a crit-named parameter the caller placed
 * in the UNPROTECTED bucket, with the accurate error.
 */
export const mergeCoseProtected = ({
  alg,
  typ,
  cty,
  entries,
  proprietary,
  format,
  error,
}: {
  /** The label-1 value: a COSE algorithm label, or an encryption label for CWE. */
  alg: number;
  typ: string;
  /** The label-3 value, or absent when the wire derives none. */
  cty?: string;
  entries: Map<CoseLabel, unknown>;
  /**
   * The caller's INTEROP MODE. The three derived parameters here are all
   * REGISTERED (labels 1/16/3), so it cannot change what this function writes
   * today — it is threaded so the derived parameters and the caller's entries
   * are spelled by the SAME resolver, and a derived parameter that ever landed in
   * the private-use range degrades with the rest instead of being the one
   * uninterpretable label on an interoperable token.
   */
  proprietary: boolean | undefined;
  /** The wire format tag, which namespaces the `crit` refusal's code. */
  format: TokenFormatTag;
  /** The kit's own error class, so the refusal names the format it came from. */
  error: typeof CoseError;
}): Buffer => {
  const map = new Map<CoseLabel, unknown>();

  map.set(coseWireKey("alg", proprietary), alg);
  map.set(coseWireKey("typ", proprietary), typ);
  if (cty !== undefined) map.set(coseWireKey("cty", proprietary), cty);

  for (const [label, value] of entries) map.set(label, value);

  // The bucket is complete HERE, and nothing has been encoded yet — see the
  // docstring. `crit` rides label 2 in both interop modes (it is registered), and
  // the resolver is asked for it anyway so this function spells every label it
  // touches one way.
  assertCritSatisfied({
    bucket: map,
    critKey: coseWireKey("crit", proprietary),
    format,
    error,
  });

  return encodeProtectedHeader(map);
};
