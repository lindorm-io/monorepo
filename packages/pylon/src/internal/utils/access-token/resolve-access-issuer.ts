import { ServerError } from "@lindorm/errors";
import { isString } from "@lindorm/is";
import type { PylonAnyContext } from "../../../types/index.js";

/**
 * The ONE issuer this deployment is a party to, read from the policy resolved at
 * boot. No mount declares it: the auth driver names a scope, amphora settles the
 * issuer for that scope while fetching its keys, and `buildAppConfig` records
 * the answer. A per-mount issuer option would be a second copy of a constant,
 * free to disagree with the keys verification actually runs against.
 *
 * Required on BOTH credential arms. Throwing beats resolving without one: an
 * absent `issuer` matcher is not a weaker check, it is NO check, and every token
 * from every issuer whose key amphora happens to hold would be accepted.
 *
 * ⚠ The introspected arm reaches this too. RFC 7662 makes the authorization
 * server the authority on an opaque credential, but "the authority answered" is
 * not "the answer came from OUR authority" — the structured arm rejects an `iss`
 * that is not ours unconditionally, and an opaque credential that skipped the
 * comparison would be the laxer of two arms serving the same mount.
 */
export const resolveAccessIssuer = (ctx: PylonAnyContext): string => {
  const issuer = ctx.state.app.config.auth?.issuer;

  if (isString(issuer) && issuer.length > 0) return issuer;

  throw new ServerError("Access token issuer is unresolved", {
    code: "access_issuer_unresolved",
    type: "urn:lindorm:pylon:error:access_issuer_unresolved",
    title: "Access Issuer Unresolved",
    details:
      'useAccessToken verifies against `ctx.state.app.config.auth.issuer`, which this deployment did not resolve. Configure an `auth` block whose driver can name its issuer — `new JwtDriver({ issuer: "self" })` for a service that mints its own tokens, `"idp"` for a resource server pinning its upstream.',
    data: { auth: ctx.state.app.config.auth === null ? "unconfigured" : "unresolved" },
  });
};
