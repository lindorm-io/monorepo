import { isUri, isUrlLike, isUrn } from "@lindorm/is";
import { AmphoraError } from "../../errors/index.js";
import type { AmphoraExternalSettings } from "../../types/index.js";

/**
 * The SYNCHRONOUS item-1 validation of a declared external issuer source — run at
 * REGISTRATION time (construction / `addIssuer` / `idp.set`, via `seedExternalConfig`)
 * so an invalid source is rejected up front, independent of `load` (a lazy source
 * would otherwise only surface its error on a later refresh, as a `warn`). It mirrors
 * the resolvable/unresolvable branches of `resolveExternalConfig` WITHOUT fetching:
 * returns for a valid source, throws for an invalid one.
 *
 * - an explicit `openIdConfigurationUri` is sufficient on its own;
 * - a present issuer must be a URI (URL-with-authority OR URN) — never a bare id
 *   (`external_issuer_not_uri`);
 * - a URI issuer WITH a `jwksUri` is valid (direct; the issuer may be a URN here);
 * - a URN issuer with NO `jwksUri` cannot be discovered (a URN has no authority to
 *   fetch from) → `urn_issuer_requires_jwks_uri`;
 * - a URL issuer with no `jwksUri` is discoverable;
 * - anything else is unusable → `invalid_issuer_options`.
 */
export const validateExternalSource = (input: AmphoraExternalSettings): void => {
  if (isUrlLike(input.openIdConfigurationUri)) return;

  if (input.issuer !== undefined && !isUri(input.issuer)) {
    throw new AmphoraError("External issuer must be a URI", {
      code: "external_issuer_not_uri",
      data: { issuer: input.issuer },
      title: "External Issuer Not URI",
      details: `The external issuer "${input.issuer as string}" is not a URI. An issuer must be a URL with an authority (https://…) or a URN (urn:…).`,
    });
  }

  if (isUri(input.issuer) && isUrlLike(input.jwksUri)) return;

  if (isUrn(input.issuer)) {
    throw new AmphoraError("URN issuer requires an explicit jwksUri", {
      code: "urn_issuer_requires_jwks_uri",
      data: { issuer: input.issuer },
      title: "URN Issuer Requires JWKS URI",
      details: `The URN issuer "${input.issuer}" has no authority to discover keys from. Provide an explicit jwksUri for URN issuers.`,
    });
  }

  if (isUrlLike(input.issuer) && !isUrn(input.issuer)) return;

  throw new AmphoraError("Invalid external issuer options", {
    code: "invalid_issuer_options",
    data: {
      issuer: input.issuer,
      jwksUri: input.jwksUri,
      openIdConfigurationUri: input.openIdConfigurationUri,
    },
    title: "Invalid Issuer Options",
    debug: {
      openIdConfiguration: input.openIdConfiguration,
      trustAnchors: input.trustAnchors,
    },
    details:
      "An external issuer must provide a valid openIdConfigurationUri, a URL issuer to discover from, or a URI issuer together with a valid jwksUri.",
  });
};
