import type {
  AegisSignKey,
  SignedToken,
  JoseSignUnstructuredTokenOptions,
  CoseSignUnstructuredTokenOptions,
  TokenContent,
} from "../../types/index.js";
import { assertWireInput } from "../wire/assert-wire-input.js";
import type { SignOpaqueInput } from "../wire/token-wire.js";
import { tokenWireFor } from "../wire/token-wire-for.js";
import type { AegisDeps } from "./aegis-deps.js";
import type { TokenFormatOfKind } from "./token-format-kind.js";

/**
 * THE opaque sign entry — `aegis.jws.sign` and `aegis.cws.sign`, one
 * implementation.
 *
 * It runs the ONE shared guard (`assertWireInput`) over this wire's declared
 * `signOpaque` dispositions and then hands the input to `wire.signOpaque`, so an
 * option a wire cannot honour is refused BY DECLARATION, at the door, with the
 * reason the table states.
 *
 * The guard runs HERE rather than in each namespace: a check beside either door
 * is a second copy of the wire's table and can disagree with it. It takes the
 * INTERSECTION of the two opaque kits' option types because one implementation
 * serves both doors and neither type is wider on its own — the JOSE one alone has
 * `custom.header`, the COSE one alone `custom.protected`/`custom.unprotected` and
 * `proprietary` (`types/header/wire-envelope.ts`). The PUBLIC doors are the
 * per-wire ones: `aegis.jws.sign` takes the JOSE type.
 * `wire-input-disposition.test.ts` drives every row of both wires' `signOpaque`
 * tables through these doors.
 *
 * ⚠ NO domain → wire translation happens here, and none belongs here. These
 * namespaces are the WIRE tier: both opaque option types ARE their wire envelope
 * (`types/header/wire-envelope.ts`), so `tokenType` is already the bare kit prefix
 * and the header bag is already wire-named. The DOMAIN tier (`aegis.mint`,
 * `aegis.sign`) is where `domainTokenTypePrefix` / `domainHeaderToWire` run.
 *
 * ⚠ The kit option surface travels by REST SPREAD, not by a field-by-field copy.
 * `rest` is exactly that intersection, so a new kit sign option threads through
 * with no change here and cannot be dropped by this function forgetting to name
 * it — which is the failure {@link SignClaimsInput} documents on the claims side.
 */
export const rawSignOpaque = async ({
  format,
  data,
  options = {},
  deps,
}: {
  /** DERIVED from the format-kind record, so the two cannot name different sets. */
  format: TokenFormatOfKind<"opaque">;
  data: TokenContent;
  options?: JoseSignUnstructuredTokenOptions &
    CoseSignUnstructuredTokenOptions & { key?: AegisSignKey };
  deps: AegisDeps;
}): Promise<SignedToken> => {
  const wire = tokenWireFor(format);
  const { key, ...rest } = options;

  const input: SignOpaqueInput = { deps, payload: data, key, ...rest };

  // ⚠ `async`, and the keyword is load-bearing. `assertWireInput` throws
  // SYNCHRONOUSLY, so without it a refused option would throw out of
  // `aegis.jws.sign(...)` before a promise existed — breaking the `Promise`
  // return type both namespaces declare, and escaping any `.catch()` a caller
  // attached. Pinned by
  // `internal/wire/wire-input-disposition.test.ts`, which drives an unsupported
  // option through this door and asserts the rejection arrives as a rejected
  // promise.
  assertWireInput(wire.dispositions.signOpaque, input, {
    format,
    operation: "signOpaque",
  });

  return wire.signOpaque(input);
};
