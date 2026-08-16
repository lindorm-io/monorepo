import type { CoseError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";
import type { CoseLabel } from "../cose/cose-label.js";
import { encodeProtectedHeader } from "../cose/structures.js";
import { assertCritSatisfied } from "./assert-crit-satisfied.js";
import { coseWireKey } from "./header-registry.js";

/**
 * Build and ENCODE a COSE protected header: the parameters every write kit
 * derives — `alg` (label 1, the signing algorithm or, for a COSE_Encrypt0, the
 * content encryption), `typ` (label 16, the kit-computed media type) and `cty`
 * (label 3, the codec-inferred content type) — then the caller's already
 * translated and validated entries on top.
 *
 * `cty` is OPTIONAL: a CWT/CWM payload IS a CWT Claims Set (RFC 8392 §7.2 reads
 * it as a CBOR map with no cty-driven decode), so the claims writer derives no
 * content type at all and label 3 is simply absent unless a caller sets one.
 *
 * ⚠ ORDER IS PRECEDENCE, not layout: the caller's entries are written LAST, so a
 * caller value wins. `typ` is REFUSED to callers by `buildCoseHeaders` (it is
 * what routes a COSE token), while `cty` is settable and a caller value
 * legitimately overwrites the inferred one. The encoded BYTES are unaffected by
 * insertion order — `encodeCbor` is deterministic (CDE) and sorts the labels.
 *
 * ⚠ The unprotected bucket is written by a SEPARATE function
 * (`mergeCoseUnprotected`), and the reason is a DATA DEPENDENCY, not a
 * preference. A COSE_Encrypt0 must finalise its protected header BEFORE the AEAD
 * runs — that header IS the AAD — and the IV only exists after, so the two
 * buckets cannot be written in one pass.
 *
 * ⚠ THIS IS WHERE THE COSE PROTECTED BUCKET BECOMES COMPLETE, which is why the
 * `crit` check runs here ({@link assertCritSatisfied}) and not in
 * `buildCoseHeaders`. A `crit` is a statement about the FINISHED bucket, and the
 * caller's translated entries are only part of it — `alg`, `typ` and `cty` are
 * added by this function. Asked one step earlier, on the caller's fragment,
 * `crit: ["alg"]` was refused as naming a parameter "the message does not carry"
 * on a message whose protected bucket carries `alg` three lines below, while the
 * JOSE twin minted the same header: one call, two verdicts, chosen by encoding.
 * There are three callers of this function and one of it per wire write, so the
 * check has ONE site here — the COSE analogue of `buildJoseHeader`'s last line.
 *
 * ⚠ It runs on the MAP, before the bytes: the members of a COSE `crit` are LABELS
 * (RFC 9052 §1.5; `critToCoseLabels` translated them on the way in), and the map's
 * keys are the same labels, so the two are compared in one vocabulary. Rule 2 of
 * `buildCoseHeaders` has already refused a crit-named parameter the caller placed
 * in the UNPROTECTED bucket, with the accurate error; what this catches is a
 * parameter the protected bucket provides nothing for.
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
