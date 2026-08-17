import { isEmpty } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { AegisError } from "../../errors/index.js";
import { headerByJose } from "./header-registry.js";

/**
 * REFUSE the header parameters whose EMPTY value the registry says cannot be
 * disposed of at all — the first half of {@link normaliseHeaders}, and the
 * sibling of `prune-empty-headers.ts`. Two functions over ONE column
 * ({@link HeaderSpec.whenEmpty}), read through the same `headerByJose` lookup,
 * so the two dispositions cannot disagree about which parameter is which.
 *
 * ⚠ WHY A THIRD VERDICT EXISTS AT ALL. The prune's two answers each assume the
 * empty value can be DISPOSED of — dropped as noise, or carried as a statement.
 * One parameter admits neither. `x5t#S256` is the only header parameter aegis's
 * verify ENFORCES (`verify-cert-binding.ts`): the check is skipped when the
 * parameter is absent and refuses a mismatch when it is present, so PRESENCE IS
 * THE BINDING. Pruning an empty one therefore converts an unsatisfiable binding
 * into NO binding and hands the audience a token the issuer meant to constrain;
 * keeping it mints a token whose binding no certificate can ever satisfy, i.e.
 * one every conformant recipient rejects (RFC 7515 §4.1.8 defines the parameter
 * as the SHA-256 thumbprint of the certificate corresponding to the signing
 * key). Both outcomes are silent and neither is what the producer asked for, so
 * the only answer left is to fail at the WRITE — the one point where the value
 * is still in the producer's hands and can be supplied or the parameter dropped.
 *
 * ⚠ HOW REACHABLE IT IS, stated honestly rather than oversold. `x5t#S256` is
 * derived from the signing key and every aegis-owned path to it is already closed:
 * `DomainProtectedHeader` and `WireProtectedHeader` both Omit it, so no typed
 * caller can supply one; `mapTokenHeader` overwrites whatever a domain bag holds
 * with the cert tier's value; and `resolveCertBinding` throws before it reads a
 * kryptos with no chain, while `Kryptos.certificateThumbprint` answers `null` or
 * a real digest and never `""`. What is left is the BOUNDARY: `IKryptos` is an
 * interface aegis does not own, and a foreign implementation returning `""` for
 * a key that reports `hasCertificate` is the one live producer of this shape. It
 * is a guard on an interface aegis publishes, not a repair of a path aegis walks
 * — so nothing about a well-formed key's token changes.
 *
 * ⚠ WRITE SIDE ONLY, like the prune. `parseTokenHeader` does not normalise, so a
 * FOREIGN token carrying `x5t#S256: ""` still parses and is still refused where
 * it must be — by `verify-cert-binding.ts`, which compares it against the key's
 * real thumbprint and finds no match. Refusing on the read would replace an
 * accurate binding failure with a shape complaint about someone else's header.
 *
 * ⚠ TOP LEVEL and JOSE-KEYED, for the same two reasons the prune states: a
 * registered parameter's inner members are its own declared structure, and every
 * write-side bag is spelled in JOSE names by the time a normalisation sees it.
 * An UNREGISTERED key is never refused here — there is no cell to read, and the
 * closed-set rule is what disposes of it.
 */
export const refuseEmptyHeaders = (dict: Dict): void => {
  for (const [key, value] of Object.entries(dict)) {
    if (headerByJose(key)?.whenEmpty !== "refuse") continue;
    if (!isEmpty(value)) continue;

    // ⚠ `whenEmpty` IS PART OF THE OBSERVABLE VERDICT, not decoration. `parameter`
    // alone does not identify this refusal: on JOSE `x5t#S256` is also in every
    // kit's `reserved` row, so `jose_reserved_header` throws the SAME class with
    // the SAME `data: { parameter }` — and a probe pinning only those two passes
    // whether or not this guard exists (measured: deleting the call from
    // `normaliseHeaders` left the JOSE cell green). Naming the registry CELL that
    // decided is what tells the two apart, and it is honest rather than invented:
    // the two refusals answer different questions — who may SET this parameter,
    // versus what this parameter's EMPTY value means — and the cell is the second
    // one's whole reason. It is the shape rule 4 of `build-cose-headers.ts`
    // already uses (`data: { parameter, placement: "protected" }`), for the same
    // reason: a registry-driven refusal reports the column and the value that
    // drove it.
    //
    // ⚠ `AegisError`, DELIBERATELY, though the sibling registry verdict next door
    // throws `CoseError` (`header-registry.ts`'s `header_no_cose_label`). ⛔ Do
    // not "fix" the inconsistency — the two VERDICTS differ in scope. "COSE has
    // no label for this parameter" is a fact about one wire and rightly names it;
    // "this parameter refuses an empty value" is wire-agnostic, and four of this
    // function's call sites (`mapTokenHeader`, `shapeWireHeader`,
    // `wireHeaderToCoseMap`, the domain crossing) hold no format tag to spell a
    // wire-specific class or code with. A wire-spelled error at four sites and a
    // neutral one at four others is the drift this package keeps removing.
    // `AegisError` is the base every aegis error extends, so a consumer catching
    // it catches this; one bracketing on `JoseError`/`CoseError` is bracketing
    // more narrowly than the contract promises.
    throw new AegisError(`Header parameter "${key}" carries no value`, {
      code: "header_empty_parameter",
      data: { parameter: key, whenEmpty: "refuse" },
      title: "Header Parameter Carries No Value",
      details:
        "This header parameter states a guarantee the recipient enforces, so an empty one can be neither emitted nor removed: dropping it turns an unsatisfiable guarantee into no guarantee at all, and emitting it mints a token every conformant recipient must reject. The value has to be supplied, or the parameter left out.",
    });
  }
};
