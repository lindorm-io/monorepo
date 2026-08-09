import { isHttpUrl, isUri } from "@lindorm/is";
import { AmphoraError } from "../../errors/index.js";
import type { AmphoraExternalSettings } from "../../types/index.js";

/**
 * The SYNCHRONOUS item-1 validation of a declared external issuer source — run at
 * REGISTRATION time (construction / `addIssuer` / `idp.set`, via `seedExternalConfig`)
 * so an invalid source is rejected up front, independent of `load` (a lazy source
 * would otherwise only surface its error on a later refresh, as a `warn`). It mirrors
 * the resolvable/unresolvable branches of `resolveExternalConfig` WITHOUT fetching:
 * returns for a valid source, throws for an invalid one. `resolveExternalConfig`
 * asserts it again as its precondition — registration is what makes that redundant,
 * not the resolver.
 *
 * Two different questions, deliberately answered by two different guards. An
 * ISSUER is an identity, so it must be a URI (`isUri`) — a URN is a perfectly
 * good one. Everything else here is an ADDRESS amphora fetches or derives from,
 * so it must be an http(s) URL (`isHttpUrl`): `isUrlLike` accepted `foo:bar`,
 * `mailto:…` and `ftp://example.com`, none of which amphora can request.
 *
 * - a declared `openIdConfigurationUri` / `jwksUri` that is not an http(s) URL is
 *   refused outright, never skipped past (`external_openid_configuration_uri_not_http_url`,
 *   `external_jwks_uri_not_http_url`) — amphora would otherwise ignore a value the
 *   operator declared, or carry it as far as the fetch;
 * - an http(s) `openIdConfigurationUri` is sufficient on its own;
 * - a present issuer must be a URI (URL-with-authority OR URN) — never a bare id
 *   (`external_issuer_not_uri`);
 * - a URI issuer WITH a `jwksUri` is valid (direct; the issuer may be a URN here);
 * - an http(s) URL issuer with no `jwksUri` is discoverable;
 * - any other URI issuer with no `jwksUri` names no location to discover from
 *   (a URN has no authority; `ftp://…` has one nothing can fetch) →
 *   `non_http_issuer_requires_jwks_uri`;
 * - anything else is unusable → `invalid_issuer_options`.
 */
export const validateExternalSource = (input: AmphoraExternalSettings): void => {
  if (
    input.openIdConfigurationUri !== undefined &&
    !isHttpUrl(input.openIdConfigurationUri)
  ) {
    throw new AmphoraError("External openIdConfigurationUri must be an http(s) URL", {
      code: "external_openid_configuration_uri_not_http_url",
      data: { openIdConfigurationUri: input.openIdConfigurationUri },
      title: "External OpenID Configuration URI Not HTTP URL",
      details: `The openIdConfigurationUri "${input.openIdConfigurationUri as string}" is not an http(s) URL. Amphora fetches the discovery document from it, so it must be a URL with a host, over http or https.`,
    });
  }

  if (input.jwksUri !== undefined && !isHttpUrl(input.jwksUri)) {
    throw new AmphoraError("External jwksUri must be an http(s) URL", {
      code: "external_jwks_uri_not_http_url",
      data: { jwksUri: input.jwksUri },
      title: "External JWKS URI Not HTTP URL",
      details: `The jwksUri "${input.jwksUri as string}" is not an http(s) URL. Amphora fetches the key set from it, so it must be a URL with a host, over http or https.`,
    });
  }

  if (isHttpUrl(input.openIdConfigurationUri)) return;

  if (input.issuer !== undefined && !isUri(input.issuer)) {
    throw new AmphoraError("External issuer must be a URI", {
      code: "external_issuer_not_uri",
      data: { issuer: input.issuer },
      title: "External Issuer Not URI",
      details: `The external issuer "${input.issuer as string}" is not a URI. An issuer must be a URL with an authority (https://…) or a URN (urn:…).`,
    });
  }

  if (isUri(input.issuer) && isHttpUrl(input.jwksUri)) return;

  if (isHttpUrl(input.issuer)) return;

  // `as string` for the same reason as `external_issuer_not_uri` above: both
  // guards assert `input is string` over the same value, so the false branch of
  // one subtracts `string` and TypeScript reaches here believing the issuer can
  // only be `undefined`. A URN reaches here, and the message names it.
  if (isUri(input.issuer)) {
    throw new AmphoraError("Non-http issuer requires an explicit jwksUri", {
      code: "non_http_issuer_requires_jwks_uri",
      data: { issuer: input.issuer },
      title: "Non-HTTP Issuer Requires JWKS URI",
      details: `The issuer "${input.issuer as string}" is not an http(s) URL, so there is no location to discover keys from. Provide an explicit jwksUri, or use an http(s) issuer.`,
    });
  }

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
      "An external issuer must provide an http(s) openIdConfigurationUri, an http(s) URL issuer to discover from, or a URI issuer together with an http(s) jwksUri.",
  });
};
