import { isEmpty } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { AegisError } from "../../errors/index.js";
import { headerByJose } from "./header-registry.js";

/**
 * REFUSE the header parameters whose EMPTY value the registry says cannot be
 * disposed of at all — the first half of {@link normaliseHeaders}, and the
 * sibling of `prune-empty-headers.ts`. Two functions over ONE column
 * ({@link HeaderSpec.whenEmpty}), read through the same `headerByJose` lookup.
 *
 * ⚠⚠ WHY A THIRD VERDICT EXISTS. The prune's two answers each assume the empty
 * value can be DISPOSED of — dropped as noise, or carried as a statement. One
 * parameter admits neither. `x5t#S256` is the only header parameter aegis's
 * verify ENFORCES (`verify-cert-binding.ts`), and the check is PRESENCE-GATED:
 * skipped when the parameter is absent, refusing a mismatch when it is present.
 * So pruning an empty one converts an unsatisfiable binding into NO binding and
 * hands the audience a token the issuer meant to constrain, while keeping it
 * mints a binding no certificate can satisfy (RFC 7515 §4.1.8 defines it as the
 * thumbprint of the certificate corresponding to the signing key). Both are
 * silent, so the only answer left is to fail at the WRITE, where the value is
 * still in the producer's hands.
 *
 * ⚠ IT GUARDS A BOUNDARY, not a path aegis walks. `DomainProtectedHeader` and
 * `WireProtectedHeader` both Omit the parameter, `mapTokenHeader` overwrites it
 * with the cert tier's value, and `Kryptos.certificateThumbprint` answers `null`
 * or a real digest — never `""`. `IKryptos` is an interface aegis does not own,
 * and a foreign implementation returning `""` for a key reporting
 * `hasCertificate` is the one live producer of this shape.
 *
 * ⚠ WRITE SIDE ONLY, like the prune. A FOREIGN token carrying `x5t#S256: ""`
 * still parses and is still refused by `verify-cert-binding.ts`, which finds no
 * match against the key's real thumbprint. Refusing on the read would replace an
 * accurate binding failure with a shape complaint about someone else's header.
 *
 * ⚠ TOP LEVEL and JOSE-KEYED, for the two reasons the prune states. An
 * UNREGISTERED key is never refused here — the closed-set rule disposes of it.
 *
 * pinned: refuse-empty-headers.test.ts.
 */
export const refuseEmptyHeaders = (dict: Dict): void => {
  for (const [key, value] of Object.entries(dict)) {
    if (headerByJose(key)?.whenEmpty !== "refuse") continue;
    if (!isEmpty(value)) continue;

    // ⚠ `whenEmpty` IS PART OF THE OBSERVABLE VERDICT, not decoration. `parameter`
    // alone does not identify this refusal: on JOSE `x5t#S256` is also in every
    // kit's `reserved` row, so `jose_reserved_header` throws the SAME class with
    // the SAME `data: { parameter }`, and a probe pinning only those two passes
    // whether or not this guard exists — measured by deleting the call from
    // `normaliseHeaders`, which left the JOSE cell green. The two refusals answer
    // different questions (who may SET this parameter, versus what its EMPTY value
    // means), so naming the cell that decided is what tells them apart.
    //
    // ⛔ `AegisError`, not the `CoseError` the sibling registry verdict throws
    // (`header-registry.ts`'s `header_no_cose_label`) — do not "fix" the
    // inconsistency. "COSE has no label for this parameter" is a fact about one
    // wire; "this parameter refuses an empty value" is wire-agnostic, and four of
    // this function's call sites hold no format tag to spell a wire-specific class
    // with. `AegisError` is the base every aegis error extends, so a consumer
    // bracketing on `JoseError`/`CoseError` brackets more narrowly than the
    // contract promises.
    throw new AegisError(`Header parameter "${key}" carries no value`, {
      code: "header_empty_parameter",
      data: { parameter: key, whenEmpty: "refuse" },
      title: "Header Parameter Carries No Value",
      details:
        "This header parameter states a guarantee the recipient enforces, so an empty one can be neither emitted nor removed: dropping it turns an unsatisfiable guarantee into no guarantee at all, and emitting it mints a token every conformant recipient must reject. The value has to be supplied, or the parameter left out.",
    });
  }
};
