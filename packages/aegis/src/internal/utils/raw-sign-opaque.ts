import type {
  AegisSignKey,
  SignedToken,
  SignUnstructuredTokenOptions,
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
 * The guard runs HERE rather than in each namespace: the two doors take the same
 * option type, so a check beside either one is a second copy of the wire's table
 * and can disagree with it. `wire-input-disposition.test.ts` drives every row of
 * both wires' `signOpaque` tables through these doors.
 *
 * ⚠ NO domain → wire translation happens here, and none belongs here. These
 * namespaces are the WIRE tier: `SignUnstructuredTokenOptions` is
 * `WireTokenEnvelope`, so `tokenType` is already the bare kit prefix and the
 * header bag is already wire-named. The DOMAIN tier (`aegis.mint`,
 * `aegis.sign`) is where `domainTokenTypePrefix` / `domainHeaderToWire` run.
 *
 * ⚠ The kit option surface travels by REST SPREAD, not by a field-by-field copy.
 * `rest` is exactly `SignUnstructuredTokenOptions`, so a new kit sign option
 * threads through with no change here and cannot be dropped by this function
 * forgetting to name it — which is the failure {@link SignClaimsInput} documents
 * on the claims side.
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
  options?: SignUnstructuredTokenOptions & { key?: AegisSignKey };
  deps: AegisDeps;
}): Promise<SignedToken> => {
  const wire = tokenWireFor(format);
  const { key, ...rest } = options;

  const input: SignOpaqueInput = { deps, payload: data, key, ...rest };

  // ⚠ `async`, and the keyword is load-bearing. `assertWireInput` throws
  // SYNCHRONOUSLY, so without it a refused option would throw out of
  // `aegis.jws.sign(...)` before a promise existed — breaking the `Promise`
  // return type both namespaces declare, and escaping any `.catch()` a caller
  // attached. Pinned by the refusal rows in `raw-sign-opaque.test.ts`, which
  // assert on `rejects`.
  assertWireInput(wire.dispositions.signOpaque, input, {
    format,
    operation: "signOpaque",
  });

  return wire.signOpaque(input);
};
