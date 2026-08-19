import type { Dict } from "@lindorm/types";
import { isString } from "@lindorm/is";
import { AegisDomainError } from "../../errors/index.js";
import type {
  TokenDelegation,
  TokenFormat,
  VerifiedToken,
  WireTokenHeader,
} from "../../types/index.js";
import type { NameSelector } from "../claims/claims-registry.js";
import { tokenToBuckets } from "../claims/resolve-domain-buckets.js";
import { domainTokenHeader } from "./domain-header.js";
import { extractTokenDelegation } from "./extract-token-delegation.js";
import { isClaimSatisfied } from "./rules/is-claim-satisfied.js";

/**
 * Assemble the unified domain result for a VERIFIED or PARSED claims token, on
 * either wire. It was two builders, one per wire, and they diverged in three
 * ways: the COSE one merged the two header buckets with no allowlist at all,
 * recovered the token type through its own translation, and enforced no issuer
 * gate where the JOSE one did. Only the last is a real per-wire fact, and it is a
 * PARAMETER here; the other two are now one shared translation
 * (`domainTokenHeader`), which merges the buckets under the header registry's
 * `placement` allowlist.
 *
 * `delegation` is narrowed to REQUIRED on the way out: a claims-bearing token
 * always has an act summary (an absent `act` yields `isDelegated: false`, not
 * `undefined`), and the verify policy needs it non-optional.
 */
export const buildTokenResult = <C extends Dict = Dict>({
  format,
  wire,
  protectedHeader,
  unprotectedHeader,
  token,
  encrypted,
  nameOf,
  issuerPresence,
}: {
  /**
   * The CLAIMS format actually read — `jwt`, `cwt` or `cwm`.
   *
   * ⚠ Typed as {@link TokenFormat}, which excludes the encrypting outers: this
   * builds a result whose `format` is the token's OWN kind, and an envelope is
   * reported as `wrapper` by the peel above rather than as a format here.
   */
  format: TokenFormat;
  /**
   * The wire-keyed claim payload, EXACTLY as the wire carried it — NumericDate
   * integers on JOSE, `Date`s on COSE (its claim codec decodes them inside the
   * kit). The claim decoders accept both, and the matcher pass gets its own
   * Date-normalised copy; this one is what the result reports verbatim.
   */
  wire: Dict;
  /** The INTEGRITY-PROTECTED wire header — the only bucket a signature covers. */
  protectedHeader: WireTokenHeader;
  /**
   * The UNPROTECTED wire header bucket (COSE only); `undefined` where the wire
   * carries none.
   *
   * ⚠ It IS merged into the one domain header, and the merge is what keeps a
   * parameter nothing covers from reading as though the issuer had signed it:
   * `domainTokenHeader` admits only the parameters the header registry declares
   * placeable there (`kid`, `iv` — the COSE routing and AEAD infrastructure), and
   * the protected bucket overwrites them. Everything a verifier decides by is
   * `placement: "protected"` and cannot enter this way at all. Reporting the two
   * apart instead put COSE wire vocabulary on a surface that speaks neither wire,
   * and left every JOSE result with a field that could never be populated.
   */
  unprotectedHeader: Partial<WireTokenHeader> | undefined;
  token: string;
  /** Whether an ENCRYPTING outer was peeled — the aegis confidentiality gate's input. */
  encrypted: boolean;
  nameOf: NameSelector;
  /**
   * Whether this wire's read REQUIRES an `iss` claim.
   *
   * ⚠ PRESERVED DIVERGENCE, not a design: the JOSE read has always refused a
   * claims token with no non-empty string `iss`, and the COSE read has always
   * accepted one. Making them agree is a policy change with no probe behind it,
   * so the difference is stated here as data — one boolean to flip — rather than
   * left implicit in two functions.
   */
  issuerPresence: "required" | "optional";
}): VerifiedToken<C> & { delegation: TokenDelegation } => {
  // `iss` must be a NON-EMPTY string. Not a URI: this gate also reads RFC 7523
  // client assertions, whose `iss` is the client_id (an opaque string, not a
  // URL/URN). The platform-issuer exact match is enforced by the profile floor.
  // NON-EMPTY is the demand notion, spelled as the rules layer spells it rather
  // than as a hand-written length test — one question, one name.
  if (
    issuerPresence === "required" &&
    !(isString(wire.iss) && isClaimSatisfied(wire.iss))
  ) {
    throw new AegisDomainError("Missing claim: iss", {
      code: "missing_claim_iss",
      data: { format },
      title: "Missing Claim ISS",
      details:
        "The payload has no non-empty string iss claim, which is required to read this token.",
    });
  }

  const { claims, custom, profile, sensitive } = tokenToBuckets<C>(wire, nameOf);

  return {
    format,
    header: domainTokenHeader(
      { protectedHeader, unprotectedHeader: unprotectedHeader ?? {} },
      format,
    ),
    claims,
    custom,
    profile,
    // the aegis confidentiality gate — sensitive claims are SURFACED only when the outer token
    // was encrypted. `claims` has them stripped either way, so an unencrypted
    // token carrying them in cleartext leaks nothing regardless of this line.
    sensitive: encrypted ? sensitive : undefined,
    delegation: extractTokenDelegation(wire as { act?: any }),
    wire: { payload: wire },
    token,
  };
};
