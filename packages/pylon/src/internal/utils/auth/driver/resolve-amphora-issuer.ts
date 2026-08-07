import type { IAmphora } from "@lindorm/amphora";
import { ServerError } from "@lindorm/errors";

/**
 * The two issuer scopes a pylon auth driver can pin, read off amphora — which is
 * the only thing that holds them.
 *
 * Neither can hand back a `null` issuer, so neither is re-checked here: amphora's
 * `internal` is the whole own-side identity or nothing at all, and `idp.config()`
 * throws by name (`idp_not_configured` / `idp_issuer_unresolved`) rather than
 * returning a config without an issuer. Pinning `null` would verify every token
 * against nothing, so the absence is always an error — just not always pylon's.
 */

/** `amphora.internal` — the service's OWN issuer. */
export const resolveSelfIssuer = (context: { amphora: IAmphora }): string => {
  const internal = context.amphora.internal;
  if (internal) return internal.issuer;

  throw new ServerError("Amphora declares no issuer for this service", {
    code: "self_issuer_not_configured",
    title: "Self Issuer Not Configured",
    type: "urn:lindorm:pylon:error:self_issuer_not_configured",
    details:
      "The driver pins this service's OWN issuer, which amphora derives from its `issuer` setting, but none is configured. Set `new Amphora({ issuer })` to the URL this service issues tokens under, or pin the upstream instead.",
  });
};

/** `amphora.idp` — the single upstream identity provider. */
export const resolveIdpIssuer = (context: { amphora: IAmphora }): string =>
  // `config()` throws `idp_not_configured` when no upstream is registered and
  // `idp_issuer_unresolved` when one is registered but amphora settled no issuer
  // for it. Both are amphora's own errors and both say exactly the right thing.
  context.amphora.idp.config().issuer;
