import { isEmpty } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { AegisError } from "../../errors/index.js";
import { headerByJose } from "./header-registry.js";

/**
 * REFUSE the header parameters whose EMPTY value the registry says cannot be
 * disposed of at all — the refusing step of {@link normaliseHeaders}, and the
 * sibling of `prune-empty-headers.ts`. Two functions over ONE column
 * ({@link HeaderSpec.whenEmpty}), read through the same `headerByJose` lookup.
 *
 * ⚠⚠ WHY A THIRD VERDICT EXISTS. The prune's two answers each assume the empty
 * value can be DISPOSED of — dropped as noise, or carried as a statement — and
 * `x5t#S256` admits neither. It is the only header parameter aegis's verify
 * ENFORCES (`verify-cert-binding.ts`), and the check is PRESENCE-GATED, so pruning
 * an empty one converts an unsatisfiable binding into NO binding while keeping it
 * mints a binding no certificate can satisfy (RFC 7515 §4.1.8). Both are silent, so
 * the only answer left is to fail at the WRITE.
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
    // kit's `reserved` row, so `jose_reserved_header` throws the SAME class with the
    // SAME `data: { parameter }`, and a probe pinning only those two stays green
    // whether or not this guard exists. The two refusals answer different questions
    // — who may SET this parameter, versus what its EMPTY value means — so naming
    // the cell that decided is what tells them apart.
    //
    // ⛔ `AegisError`, not the `CoseError` the sibling registry verdict throws — do
    // not "fix" the inconsistency. "COSE has no label for this parameter" is a fact
    // about one wire; "this parameter refuses an empty value" is wire-agnostic, and
    // several call sites hold no format tag to spell a wire-specific class with.
    throw new AegisError(`Header parameter "${key}" carries no value`, {
      code: "header_empty_parameter",
      data: { parameter: key, whenEmpty: "refuse" },
      title: "Header Parameter Carries No Value",
      details:
        "This header parameter states a guarantee the recipient enforces, so an empty one can be neither emitted nor removed: dropping it turns an unsatisfiable guarantee into no guarantee at all, and emitting it mints a token every conformant recipient must reject. The value has to be supplied, or the parameter left out.",
    });
  }
};
