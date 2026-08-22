import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { pruneEmptyHeaders } from "./prune-empty-headers.js";
import { refuseEmptyHeaders } from "./refuse-empty-headers.js";

/**
 * The single normalisation applied to a header bag on the way to the wire, shared
 * by JOSE and COSE, and the twin of `internal/utils/normalise-claims.ts`.
 *
 * ⚠ `omitUndefined` MUST STAY FIRST. `isEmpty(undefined)` is `true`, so a refusal
 * reached before the strip would answer a bag that merely OMITS the parameter — and
 * `mapTokenHeader` spreads exactly such a bag, so every kit carrying an optional
 * field would throw for a parameter nobody set. The other two steps are
 * interchangeable: they read the same `whenEmpty` cell for DIFFERENT answers.
 * ⛔ Widen either from its exact answer to "anything but keep" and that independence
 * is gone — the widening PLUS a swap prunes the certificate binding silently,
 * though either change alone is inert.
 * pinned: normalise-headers.test.ts, refuse-empty-headers.test.ts,
 * prune-empty-headers.test.ts.
 *
 * ⛔ WRITE SIDE ONLY — `parseTokenHeader` must not call it. The read side
 * defaults `critical` to `[]` because `DomainTokenHeader.critical` is
 * non-optional (`internal/utils/token-header.ts`), so a read-side prune would
 * delete the value the parser just wrote; and a read must report what a producer
 * WROTE, which is the evidence `validate-crit.ts`, `JweKit.decrypt`'s `zip`
 * refusal and `verify-cert-binding.ts` fire on.
 *
 * ⚠ IDEMPOTENT, because a bag crosses it TWICE by design: a door that reads the
 * caller's bag before the header is assembled — `serialiseContent(data,
 * callerHeader.cty)` picks the payload serialisation — normalises at the door,
 * and the emission boundary normalises again. A door that grows a payload-shaping
 * step consulting the caller's header owes a call at the door the same day.
 *
 * ⚠ IT KNOWS NOTHING ABOUT `crit`, and must not: a parameter a message's `crit`
 * names cannot be empty by the time this runs, because `assert-crit-satisfied.ts`
 * refuses that header outright. So there is no referent a prune could leave
 * dangling and no exemption to scope.
 *
 * ⛔ THE KIT-DERIVED `cty` IS THE CROSS-WIRE HAZARD. It reaches the JOSE header
 * through a normalising tier but goes straight into the COSE label map behind a
 * bare `!== undefined` (`merge-cose-protected.ts`), so an empty derived value
 * would be pruned on one wire and emitted as `[3, ""]` on the other. Fix that
 * upstream of both, never with a second rule at the COSE write.
 */
export const normaliseHeaders = <T extends Dict = Dict>(dict: T): T => {
  const stripped = omitUndefined(dict);

  refuseEmptyHeaders(stripped);

  return pruneEmptyHeaders(stripped);
};
