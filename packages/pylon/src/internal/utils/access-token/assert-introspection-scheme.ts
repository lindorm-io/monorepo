import { ClientError } from "@lindorm/errors";
import { isString, isUndefined } from "@lindorm/is";
import type { PylonIntrospectionActive } from "../../../types/index.js";

/**
 * The RFC 6749 §7.1 scheme a credential was PRESENTED under, in the lowercase
 * vocabulary `resolveHttpTokenSource` already normalises the `Authorization`
 * header to — so there is one spelling of the pair, not a second table mapping
 * it back to `Bearer`/`DPoP`.
 */
export type PresentedScheme = "bearer" | "dpop";

/**
 * The optional bound on RFC 7662 §2.2's `token_type`: an answer that states none
 * is accepted, an answer that CONTRADICTS how the credential was presented is
 * refused.
 *
 * ⚠ RFC 7662's `token_type` is RFC 6749 §7.1's PRESENTATION SCHEME
 * (`Bearer`/`DPoP`) — a homonym of the JOSE `typ` the `access_token` profile
 * floor matches, and of aegis's `tokenType` matcher, which means that other one.
 * So there is no `at+jwt`-shaped value to compare it against, and it must never
 * be routed through the domain matcher of the same name.
 *
 * ⚠ ABSENCE is tolerated, and that is the point of the bound. RFC 7662 §2.2
 * makes every member a MAY, and refusing a bare `{ active: true }` refused a
 * conformant answer for nothing.
 *
 * ⚠ The comparison is one-directional, and DELIBERATELY so — it is not a
 * symmetric `answer === presented`. The only thing an answer can assert that the
 * REQUEST must have lived up to is `DPoP`: a credential the authorization server
 * says is proof-of-possession bound, presented under the `Bearer` scheme, is
 * spent with no proof at all. That is invisible anywhere else on the opaque arm
 * — an answer naming `DPoP` while omitting `cnf.jkt` (RFC 9449 §6.2) leaves
 * `assertDpopBinding` nothing to compare, so it correctly no-ops and the bound
 * credential goes through as a plain bearer token.
 *
 * The mirror case needs no rule and must not get one: an answer of `Bearer` for
 * a credential presented under `DPoP` is the request holding itself to the
 * STRICTER standard, and it is already fully covered — with `cnf.jkt` the proof
 * is verified, without it `assertDpopBinding` refuses the DPoP scheme outright
 * (`token_not_dpop_bound`). Refusing it here would add no check and would break
 * every authorization server that answers `Bearer` for its bound tokens, which
 * is the same class of bug as refusing an absent member.
 *
 * ⚠ The comparison is CASE-INSENSITIVE. RFC 7235 §2.1 makes the auth scheme
 * case-insensitive, and real authorization servers return `bearer`, `Bearer` and
 * `DPoP` interchangeably — a case-sensitive match would refuse conformant
 * answers.
 */
export const assertIntrospectionScheme = (
  introspection: PylonIntrospectionActive,
  scheme: PresentedScheme | undefined,
): void => {
  const stated = isString(introspection.tokenType)
    ? introspection.tokenType.trim().toLowerCase()
    : "";

  // Nothing stated — an absent member, or one that is empty and so says nothing
  // either.
  if (stated.length === 0) return;

  // The transport carries no authorization scheme, so there is nothing for the
  // answer to contradict. See the `resolveAccess` call sites for which those are.
  if (isUndefined(scheme)) return;

  // Every other scheme — `Bearer`, or one pylon does not implement — asserts no
  // binding, so the presentation has nothing to live up to.
  const assertsBinding = stated === "dpop";
  if (assertsBinding !== true) return;

  if (scheme === "dpop") return;

  throw new ClientError("Access token is not DPoP bound", {
    status: ClientError.Status.Unauthorized,
    code: "introspection_token_type_mismatch",
    type: "urn:lindorm:pylon:error:introspection_token_type_mismatch",
    title: "Introspection Token Type Mismatch",
    details:
      "Token introspection answered token_type: DPoP (RFC 7662 §2.2), so the credential is proof-of-possession bound and RFC 9449 §7.1 requires it to be presented under the DPoP scheme. It was presented as a bearer token, which carries no proof.",
    data: { presented: scheme, stated: introspection.tokenType },
  });
};
